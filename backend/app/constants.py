VALID_CATEGORIES = {
    "shampoo",
    "bodywash",
    "conditioner",
    "lotion",
    "cleanser",
}

VALID_SOURCES = {"manual", "doubao", "auto"}

ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

# 当前豆包图片入口的稳定格式（避免 HEIC/HEIF 触发上游不稳定 5xx）
DOUBAO_SUPPORTED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}
