# IBVAP Deployment Guide

## 1. Edge Appliance Deployment
IBVAP is designed for deployment on edge servers, ruggedized tactical command laptops, or border outpost workstations.

### Hardware Recommendations
- **CPU**: Intel Core i5/i7 (10th gen+) or AMD Ryzen 5/7
- **RAM**: 16 GB DDR4/DDR5
- **GPU**: NVIDIA GTX 1650 / RTX 3060 (Optional: CPU-only inference baseline is fully supported)
- **Storage**: 256 GB SSD (for video buffers and evidence vault)

---

## 2. Docker Deployment
Run IBVAP in isolated containers on Ubuntu 24.04:

```bash
cd docker
docker-compose up -d --build
```