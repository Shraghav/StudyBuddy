import requests

url = "https://fobmuwhfmpsokrlptbgi.supabase.co/auth/v1/token?grant_type=password"
headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvYm11d2hmbXBzb2tybHB0YmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NzIxMzgsImV4cCI6MjA4ODQ0ODEzOH0.4tsaTbGDEGVeVXga7EenAQd52RylsePfqfq6gu9a3v4",
    "Content-Type": "application/json"
}
data = {
    "email": "harishragavan04@gmail.com",
    "password": "Qwerty12345"
}

response = requests.post(url, headers=headers, json=data)

if response.status_code == 200:
    print("--- ACCESS TOKEN ---")
    print(response.json()['access_token'])
else:
    print(f"Error: {response.status_code}")
    print(response.text)


# import os

from dotenv import load_dotenv
import os
load_dotenv()
DATABASE_URL =  os.getenv("DATABASE_URL")
print("Key:", DATABASE_URL)
