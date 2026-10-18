"""SPECTRA v3 private-beta cloud pilot: deliberately limited passive queries.
This does NOT expose the legacy local FastAPI routes, local databases, or active scanning.
"""
import os, re, ipaddress
from contextlib import asynccontextmanager
import httpx
from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

DOMAIN = re.compile(r"^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$", re.I)
DNS_TYPES = {"A":1,"AAAA":28,"MX":15,"NS":2,"TXT":16,"CNAME":5,"CAA":257}
BASE = os.getenv("SUPABASE_URL", "").rstrip("/")
KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
ORIGIN = os.getenv("SPECTRA_FRONTEND_ORIGIN", "https://spectra-psi-eight.vercel.app").rstrip("/")
ENABLED = (BASE.startswith("https://") and BASE.endswith(".supabase.co") and KEY.startswith("sb_publishable_"))

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with httpx.AsyncClient(timeout=httpx.Timeout(12, connect=4), follow_redirects=False, trust_env=False) as client:
        app.state.client = client
        yield

app = FastAPI(title="SPECTRA Private Beta Cloud Pilot", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[ORIGIN], allow_credentials=False, allow_methods=["GET"], allow_headers=["Authorization"], max_age=300)

@app.middleware("http")
async def harden(request: Request, next_handler):
    # Host-level rate limiting and upstream limits remain necessary for general DDoS protection.
    if request.method not in {"GET", "OPTIONS"}:
        return JSONResponse({"detail":"Method not allowed"},status_code=405)
    result = await next_handler(request)
    result.headers["Cache-Control"]="no-store"
    result.headers["X-Content-Type-Options"]="nosniff"
    return result

@app.get("/health")
async def health():
    return {"status":"ok" if ENABLED else "not_configured"}

async def authorize(request: Request, authorization: str | None):
    if not ENABLED:
        raise HTTPException(503,"Server not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401,"Sign in required")
    token=authorization[7:].strip()
    if not token or len(token)>4096:
        raise HTTPException(401,"Invalid session")
    client=request.app.state.client
    headers={"apikey":KEY,"Authorization":"Bearer "+token}
    try:
        user=await client.get(BASE+"/auth/v1/user",headers=headers)
        if user.status_code!=200:
            raise HTTPException(401,"Session expired or invalid")
        uid=user.json().get("id")
        confirmed=user.json().get("email_confirmed_at")
        if not uid or not confirmed:
            raise HTTPException(403,"Verified account required")
        # PostgREST row-level security filters the membership by the user's JWT.
        m=await client.get(BASE+"/rest/v1/beta_memberships",params={"select":"user_id,plan,status,expires_at","user_id":"eq."+uid},headers=headers)
        if m.status_code!=200:
            raise HTTPException(503,"Membership verification unavailable")
        rows=m.json()
        from datetime import datetime, timezone
        if len(rows)!=1 or rows[0].get("plan")!="pro" or rows[0].get("status")!="active":
            raise HTTPException(403,"Active PRO Beta required")
        until=datetime.fromisoformat(rows[0]["expires_at"].replace("Z","+00:00"))
        if until<=datetime.now(timezone.utc):
            raise HTTPException(403,"Beta period has expired")
        # Atomic server-side quota. SQL function verifies auth.uid(), membership and expiration again.
        quota=await client.post(BASE+"/rest/v1/rpc/consume_beta_cloud_quota",headers={**headers,"Content-Type":"application/json"},json={})
        if quota.status_code!=200:
            raise HTTPException(503,"Quota enforcement unavailable")
        if quota.json() is not True:
            raise HTTPException(429,"Daily quota reached or membership expired")
    except httpx.HTTPError:
        raise HTTPException(503,"Authentication service unavailable")


def check_domain(raw):
    try: domain=raw.strip().rstrip(".").encode("idna").decode("ascii").lower()
    except (UnicodeError,ValueError): raise HTTPException(422,"Invalid domain")
    if not DOMAIN.fullmatch(domain): raise HTTPException(422,"Invalid public domain")
    try: ipaddress.ip_address(domain); raise HTTPException(422,"Use a domain")
    except ValueError: pass
    return domain

@app.get("/api/v3/dns/{domain}")
async def dns_lookup(domain: str, request: Request, authorization: str | None = Header(default=None), record_type: str = "A"):
    await authorize(request,authorization)
    name=check_domain(domain)
    record_type=record_type.upper()
    if record_type not in DNS_TYPES: raise HTTPException(422,"Unsupported DNS record type")
    try:
        r=await request.app.state.client.get("https://dns.google/resolve",params={"name":name,"type":DNS_TYPES[record_type]},headers={"Accept":"application/dns-json"})
        r.raise_for_status()
        obj=r.json()
        return {"source":"Google Public DNS","source_url":"https://dns.google/resolve","domain":name,"type":record_type,"dns_status":obj.get("Status"),"answers":obj.get("Answer",[])[:100]}
    except (httpx.HTTPError,ValueError): raise HTTPException(502,"DNS provider unavailable")

@app.get("/api/v3/history/{domain}")
async def history(domain: str, request: Request, authorization: str | None=Header(default=None)):
    await authorize(request,authorization)
    name=check_domain(domain)
    try:
        r=await request.app.state.client.get("https://web.archive.org/cdx/search/cdx",params={"url":name,"output":"json","filter":"statuscode:200","collapse":"urlkey","fl":"timestamp,original,statuscode","limit":"20"},timeout=httpx.Timeout(16,connect=4))
        r.raise_for_status()
        data=r.json()
        return {"source":"Internet Archive Wayback CDX","domain":name,"records":data[1:21] if isinstance(data,list) else [],"note":"Index results may be delayed or unavailable"}
    except (httpx.HTTPError,ValueError): raise HTTPException(502,"Archive provider unavailable")
