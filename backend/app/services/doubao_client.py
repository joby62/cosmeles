import json
from pathlib import Path
from app.settings import settings

class DoubaoClient:
    """
    MVP：支持 mock / real 两种模式
    - mock：直接读 sample_data/product_sample.json（你可用你那份示例 JSON 替换）
    - real：你把豆包 API 调用写进来即可（保持返回 dict）
    """
    def __init__(self):
        self.mode = settings.doubao_mode.lower()

    def analyze(self, image_path: str) -> dict:
        if self.mode == "mock":
            sample = Path(__file__).resolve().parents[2] / "sample_data" / "product_sample.json"
            return json.loads(sample.read_text(encoding="utf-8"))

        # TODO: REAL 模式：在这里接入豆包 API
        # 要求返回一个 dict，结构满足 ProductDoc schema
        raise NotImplementedError("DOUBAO_MODE=real is not implemented yet.")
