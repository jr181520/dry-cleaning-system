# MongoDB Docker 启动脚本
docker run -d `
  --name dry-cleaning-mongo `
  -p 27017:27017 `
  -v mongo-data:/data/db `
  -e MONGO_INITDB_DATABASE=dry_cleaning `
  mongo:latest
