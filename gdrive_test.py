from google.oauth2 import service_account
from googleapiclient.discovery import build

SERVICE_ACCOUNT_FILE = 'festive-nova-429210-b3-acf37ef44cdf.json'
SCOPES = ['https://www.googleapis.com/auth/drive']
ROOT_FOLDER_ID = '1v8KuHvik1BqXEJScTHygb2_w-y32tThW'

creds = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES)

drive_service = build('drive', 'v3', credentials=creds)

result = drive_service.files().get(fileId=ROOT_FOLDER_ID, fields="id, name").execute()
print(f"✅ Успешно! Доступ к папке: {result['name']} ({result['id']})")
