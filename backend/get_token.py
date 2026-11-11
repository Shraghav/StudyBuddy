import os

import requests
from dotenv import load_dotenv

load_dotenv()
supabase_key=os.getenv("SUPABASE_KEY")

url = "https://fobmuwhfmpsokrlptbgi.supabase.co/auth/v1/token?grant_type=password"
headers = {
    "apikey": supabase_key ,
    "Content-Type": "application/json"
}
data = {
    "email": "abc@gmail.com",
    "password": "Qwerty12345"
}

response = requests.post(url, headers=headers, json=data)

if response.status_code == 200:
    print("--- ACCESS TOKEN ---")
    print(response.json()['access_token'])
else:
    print(f"Error: {response.status_code}")
    print(response.text)