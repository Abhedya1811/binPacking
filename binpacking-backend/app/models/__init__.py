# """
# Models Package - Database table definitions using SQLAlchemy ORM
# """

# from app.db.base import Base

# # Import all models here
# from .user import User
# from .packing import PackingJob, PackingHistory

# # Export all models for easy importing
# __all__ = [
#     "Base",
#     "User", 
#     "PackingJob",
#     "PackingHistory"
# ]

# """
# WHY THIS FILE EXISTS:
# 1. Makes 'models' a proper Python package
# 2. Single import point: 'from app.models import User, PackingJob'
# 3. Centralized model registry for Alembic migrations
# 4. Clean separation from other app components
# """