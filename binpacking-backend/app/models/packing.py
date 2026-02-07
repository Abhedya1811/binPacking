# from sqlalchemy import Column, String, Float, Integer, JSON, DateTime, ForeignKey, Text
# from sqlalchemy.dialects.postgresql import UUID
# from sqlalchemy.orm import relationship
# import uuid
# from datetime import datetime
# from app.db.base import Base


# class PackingJob(Base):
#     __tablename__ = "packing_jobs"

#     id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
#     user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True, nullable=False)

#     name = Column(String(200), nullable=False)
#     description = Column(Text)

#     bin_width = Column(Float, nullable=False)
#     bin_height = Column(Float, nullable=False)
#     bin_depth = Column(Float, nullable=False)
#     bin_weight_limit = Column(Float)
#     bin_name = Column(String(100), default="Main Bin")

#     items_data = Column(JSON, nullable=False)
#     packing_result = Column(JSON)
#     visualization_data = Column(JSON)

#     efficiency = Column(Float)
#     bins_used = Column(Integer, default=1)
#     total_items = Column(Integer)
#     total_volume = Column(Float)
#     packed_volume = Column(Float)
#     wasted_volume = Column(Float)

#     status = Column(String(50), default="pending")
#     algorithm_used = Column(String(100), default="py3dbp")

#     created_at = Column(DateTime, default=datetime.utcnow, index=True)
#     started_at = Column(DateTime)
#     completed_at = Column(DateTime)

#     user = relationship("User", back_populates="packing_jobs")
#     history = relationship("PackingHistory", back_populates="job")

#     def calculate_wasted_volume(self):
#         if self.total_volume is not None and self.packed_volume is not None:
#             self.wasted_volume = self.total_volume - self.packed_volume
#         return self.wasted_volume

#     def __repr__(self):
#         return f"<PackingJob(id={self.id}, name='{self.name}', efficiency={self.efficiency})>"


# class PackingHistory(Base):
#     __tablename__ = "packing_history"

#     id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
#     job_id = Column(UUID(as_uuid=True), ForeignKey("packing_jobs.id"), index=True, nullable=False)
#     user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True, nullable=False)

#     action = Column(String(50), nullable=False, index=True)
#     action_details = Column(JSON)
#     performed_at = Column(DateTime, default=datetime.utcnow, index=True)

#     job = relationship("PackingJob", back_populates="history")
#     user = relationship("User", back_populates="packing_history")

#     def __repr__(self):
#         return f"<PackingHistory(job_id={self.job_id}, action='{self.action}')>"

#     def get_action_description(self):
#         actions = {
#             "created": "created the packing job",
#             "viewed": "viewed the packing job",
#             "exported": "exported the packing results",
#             "modified": "modified the packing job",
#             "deleted": "deleted the packing job",
#             "shared": "shared the packing job",
#         }
#         action_key = str(self.action)
#         return actions.get(action_key, f"performed {action_key}")
