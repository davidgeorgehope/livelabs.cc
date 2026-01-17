import re
from fastapi import APIRouter, Request, Response, HTTPException, Query
from sqlalchemy.orm import Session
import httpx
from urllib.parse import urlparse
from typing import Optional
from .. import models
from ..auth import decode_token
from ..database import get_db
from fastapi import Depends

router = APIRouter(prefix="/proxy", tags=["proxy"])

# Headers to strip for iframe embedding
STRIP_HEADERS = {
    'x-frame-options',
    'content-security-policy',
    'content-security-policy-report-only',
}

# URL allowlist patterns - only proxy to these destinations
# Allows localhost/127.0.0.1 with any port (for container apps)
ALLOWED_URL_PATTERNS = [
    re.compile(r'^https?://localhost(:\d+)?(/.*)?$'),
    re.compile(r'^https?://127\.0\.0\.1(:\d+)?(/.*)?$'),
    # Add specific external domains if needed:
    # re.compile(r'^https://staging\.example\.com(/.*)?$'),
]


def is_url_allowed(url: str) -> bool:
    """Check if URL matches the allowlist patterns"""
    for pattern in ALLOWED_URL_PATTERNS:
        if pattern.match(url):
            return True
    return False


def verify_token_from_query(token: str, db: Session) -> Optional[models.User]:
    """Verify JWT token from query parameter and return user"""
    token_data = decode_token(token)
    if not token_data or not token_data.user_id:
        return None
    return db.query(models.User).filter(models.User.id == token_data.user_id).first()


@router.get("/fetch")
async def proxy_fetch(
    url: str,
    token: str = Query(..., description="JWT authentication token"),
    request: Request = None,
    db: Session = Depends(get_db)
):
    """Proxy external URLs, stripping X-Frame-Options headers for iframe embedding"""

    # Verify token (required since iframe can't send Authorization header)
    user = verify_token_from_query(token, db)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    # Validate URL scheme
    parsed = urlparse(url)
    if parsed.scheme not in ('http', 'https'):
        raise HTTPException(status_code=400, detail="Invalid URL scheme")

    if not parsed.netloc:
        raise HTTPException(status_code=400, detail="Invalid URL")

    # Security: Only allow proxying to allowlisted URLs (container ports on localhost)
    if not is_url_allowed(url):
        raise HTTPException(
            status_code=403,
            detail="URL not in allowlist. Only local container URLs are permitted."
        )

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
            # Forward relevant headers from the original request
            headers = {
                'User-Agent': request.headers.get('user-agent', 'LiveLabs-Proxy/1.0'),
            }

            # Forward accept headers
            if 'accept' in request.headers:
                headers['Accept'] = request.headers['accept']
            if 'accept-language' in request.headers:
                headers['Accept-Language'] = request.headers['accept-language']

            response = await client.get(url, headers=headers)

            # Build response headers, stripping frame-blocking ones
            response_headers = {}
            for key, value in response.headers.multi_items():
                if key.lower() not in STRIP_HEADERS:
                    # Skip certain headers that shouldn't be forwarded
                    if key.lower() not in ('transfer-encoding', 'connection', 'keep-alive'):
                        response_headers[key] = value

            return Response(
                content=response.content,
                status_code=response.status_code,
                headers=response_headers,
                media_type=response.headers.get('content-type')
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Upstream request timed out")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch URL: {str(e)}")
