import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("DATABASE_URL")
client = MongoClient(MONGO_URL)
db = client.get_database()

print("Collections in database:", db.list_collection_names())

# Check Employee collection (try both cases)
for coll_name in ["Employee", "employee"]:
    if coll_name in db.list_collection_names():
        count = db[coll_name].count_documents({})
        unregistered = db[coll_name].count_documents({"$or": [{"faceEncoding": {"$exists": False}}, {"faceEncoding": None}, {"faceEncoding": ""}]})
        print(f"Collection '{coll_name}': {count} total employees, {unregistered} unregistered.")
        
        if count > 0:
            sample = db[coll_name].find_one()
            print(f"Sample employee fields: {list(sample.keys())}")
            print(f"Sample faceEncoding: {sample.get('faceEncoding')}")
