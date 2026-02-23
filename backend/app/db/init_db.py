import os
from app.db.session import engine
from app.db.models import Base
from app.settings import settings

def main():
    os.makedirs(settings.storage_dir, exist_ok=True)
    os.makedirs(os.path.join(settings.storage_dir, "images"), exist_ok=True)
    os.makedirs(os.path.join(settings.storage_dir, "products"), exist_ok=True)

    Base.metadata.create_all(bind=engine)
    print("DB initialized.")

if __name__ == "__main__":
    main()
