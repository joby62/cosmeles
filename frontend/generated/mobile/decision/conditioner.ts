// Generated from shared/mobile/decision/conditioner.json. Do not edit by hand.

const data = {
  "schema_version": "mobile_decision_category.v1",
  "category": "conditioner",
  "route_titles": {
    "c-color-lock": "锁色固色型",
    "c-airy-light": "轻盈蓬松型",
    "c-structure-rebuild": "结构修护型",
    "c-smooth-frizz": "柔顺抗躁型",
    "c-basic-hydrate": "基础保湿型"
  },
  "matrix": {
    "category": "conditioner",
    "categories": [
      "c-color-lock",
      "c-airy-light",
      "c-structure-rebuild",
      "c-smooth-frizz",
      "c-basic-hydrate"
    ],
    "questions": [
      {
        "key": "c_q1",
        "title": "发丝受损史",
        "options": {
          "A": "频繁漂/染/烫 (干枯空洞)",
          "B": "偶尔染烫/经常使用热工具 (轻度受损)",
          "C": "原生发/几乎不折腾 (健康)"
        }
      },
      {
        "key": "c_q2",
        "title": "发丝物理形态",
        "options": {
          "A": "细软少/极易贴头皮",
          "B": "粗硬/沙发/天生毛躁",
          "C": "正常适中"
        }
      },
      {
        "key": "c_q3",
        "title": "当前最渴望的视觉效果",
        "options": {
          "A": "刚染完，需要锁色/固色",
          "B": "打结梳不开，需要极致顺滑",
          "C": "发尾不干枯，保持自然蓬松就行"
        }
      }
    ],
    "scoring_matrix": {
      "c_q1": {
        "A": [
          15,
          -5,
          20,
          10,
          -10
        ],
        "B": [
          5,
          5,
          5,
          5,
          10
        ],
        "C": [
          -15,
          10,
          -15,
          -5,
          15
        ]
      },
      "c_q2": {
        "A": [
          0,
          25,
          5,
          -20,
          5
        ],
        "B": [
          0,
          -15,
          10,
          25,
          -5
        ],
        "C": [
          0,
          5,
          0,
          5,
          5
        ]
      },
      "c_q3": {
        "A": [
          25,
          0,
          5,
          0,
          0
        ],
        "B": [
          0,
          -10,
          5,
          20,
          5
        ],
        "C": [
          0,
          10,
          0,
          -5,
          10
        ]
      }
    },
    "veto_masks": [
      {
        "trigger": "c_q2 == 'A'",
        "mask": [
          1,
          1,
          1,
          0,
          1
        ],
        "note": "质地防线：细软塌发质禁止使用重度柔顺产品，防贴头皮"
      },
      {
        "trigger": "c_q1 == 'C'",
        "mask": [
          0,
          1,
          0,
          1,
          1
        ],
        "note": "过氧化/悖论防线：原生发禁止使用结构重塑型和锁色型产品，防发丝过载变硬"
      }
    ]
  },
  "profile": {
    "steps": [
      {
        "key": "c_q1",
        "title": "Q1 发丝受损史",
        "note": "先确认基础受损程度，作为修护权重底盘。",
        "options": [
          {
            "value": "A",
            "label": "A. 频繁漂/染/烫 (干枯空洞)",
            "sub": "高受损，优先修护与抗断裂能力",
            "choice_label": "频繁漂/染/烫 (干枯空洞)"
          },
          {
            "value": "B",
            "label": "B. 偶尔染烫/经常使用热工具 (轻度受损)",
            "sub": "中度受损，平衡修护与轻盈感",
            "choice_label": "偶尔染烫/经常使用热工具 (轻度受损)"
          },
          {
            "value": "C",
            "label": "C. 原生发/几乎不折腾 (健康)",
            "sub": "低受损，避免配方过重导致发丝过载",
            "choice_label": "原生发/几乎不折腾 (健康)"
          }
        ]
      },
      {
        "key": "c_q2",
        "title": "Q2 发丝物理形态",
        "note": "这一步会触发质地防线，决定能否用重柔顺路线。",
        "options": [
          {
            "value": "A",
            "label": "A. 细软少/极易贴头皮",
            "sub": "优先轻盈蓬松，禁重度柔顺",
            "choice_label": "细软少/极易贴头皮"
          },
          {
            "value": "B",
            "label": "B. 粗硬/沙发/天生毛躁",
            "sub": "优先抗躁顺滑与服帖度",
            "choice_label": "粗硬/沙发/天生毛躁"
          },
          {
            "value": "C",
            "label": "C. 正常适中",
            "sub": "不偏科，按目标效果做收敛",
            "choice_label": "正常适中"
          }
        ]
      },
      {
        "key": "c_q3",
        "title": "Q3 当前最渴望的视觉效果",
        "note": "最后一步，锁定主诉求并给出唯一推荐路径。",
        "options": [
          {
            "value": "A",
            "label": "A. 刚染完，需要锁色/固色",
            "sub": "优先锁色膜与色泽维持能力",
            "choice_label": "刚染完，需要锁色/固色"
          },
          {
            "value": "B",
            "label": "B. 打结梳不开，需要极致顺滑",
            "sub": "优先抗毛躁与梳理滑度",
            "choice_label": "打结梳不开，需要极致顺滑"
          },
          {
            "value": "C",
            "label": "C. 发尾不干枯，保持自然蓬松就行",
            "sub": "优先基础保湿和轻盈平衡",
            "choice_label": "发尾不干枯，保持自然蓬松就行"
          }
        ]
      }
    ]
  }
} as const;

export default data;
