import requests
import sys

# Get these from your Shopify Dev Dashboard
CLIENT_ID     = "your-shopify-client-id"
CLIENT_SECRET = "your-shopify-client-secret"

if len(sys.argv) != 3:
    print("Usage: python exchange_shopify_token.py <shop_domain> <authorization_code>")
    sys.exit(1)

shop  = sys.argv[1]
code  = sys.argv[2]

url = f"https://{shop}/admin/oauth/access_token"
payload = {
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "code": code,
}

resp = requests.post(url, json=payload)
resp.raise_for_status()
data = resp.json()
print("✅ Your Admin API access token is:")
print(data['access_token'])
