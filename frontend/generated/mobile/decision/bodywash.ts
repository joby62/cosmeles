// Generated from shared/mobile/decision/bodywash.json. Do not edit by hand.

const data = {
  "schema_version": "mobile_decision_category.v1",
  "category": "bodywash",
  "route_titles": {
    "rescue": "恒温舒缓修护型",
    "purge": "水杨酸净彻控油型",
    "polish": "乳酸尿素更新型",
    "glow": "氨基酸亮肤型",
    "shield": "脂类补充油膏型",
    "vibe": "轻盈香氛平衡型"
  },
  "matrix": {
    "category": "bodywash",
    "categories": [
      "rescue",
      "purge",
      "polish",
      "glow",
      "shield",
      "vibe"
    ],
    "questions": [
      {
        "key": "q1",
        "title": "气候与微环境",
        "options": {
          "A": "干燥寒冷",
          "B": "干燥炎热",
          "C": "潮湿闷热",
          "D": "潮湿寒冷"
        }
      },
      {
        "key": "q2",
        "title": "耐受度",
        "options": {
          "A": "极度敏感",
          "B": "屏障健康"
        }
      },
      {
        "key": "q3",
        "title": "油脂与角质状态",
        "options": {
          "A": "出油旺盛",
          "B": "缺油干涩",
          "C": "角质堆积（鸡皮/厚茧）",
          "D": "状态正常（无明显痛点）"
        }
      },
      {
        "key": "q4",
        "title": "冲洗肤感偏好",
        "options": {
          "A": "清爽干脆",
          "B": "柔滑滋润"
        }
      },
      {
        "key": "q5",
        "title": "特殊限制",
        "options": {
          "A": "极致纯净",
          "B": "情绪留香"
        }
      }
    ],
    "scoring_matrix": {
      "q1": {
        "A": [
          5,
          -10,
          -5,
          0,
          10,
          0
        ],
        "B": [
          0,
          5,
          0,
          10,
          -5,
          5
        ],
        "C": [
          0,
          10,
          5,
          5,
          -10,
          5
        ],
        "D": [
          5,
          0,
          0,
          0,
          5,
          0
        ]
      },
      "q2": {
        "A": [
          15,
          0,
          0,
          0,
          0,
          0
        ],
        "B": [
          0,
          5,
          5,
          5,
          0,
          5
        ]
      },
      "q3": {
        "A": [
          0,
          20,
          10,
          0,
          -20,
          5
        ],
        "B": [
          10,
          -20,
          -10,
          0,
          20,
          0
        ],
        "C": [
          0,
          10,
          20,
          0,
          -10,
          0
        ],
        "D": [
          0,
          -5,
          -5,
          10,
          0,
          10
        ]
      },
      "q4": {
        "A": [
          0,
          5,
          5,
          5,
          -5,
          5
        ],
        "B": [
          0,
          0,
          0,
          0,
          5,
          5
        ]
      },
      "q5": {
        "A": [
          5,
          0,
          0,
          0,
          0,
          0
        ],
        "B": [
          -5,
          0,
          0,
          5,
          0,
          5
        ]
      }
    },
    "veto_masks": [
      {
        "trigger": "q2 == 'A'",
        "mask": [
          1,
          0,
          0,
          0,
          1,
          0
        ],
        "note": "病理防线：极度敏感肌强制清零所有刺激项，仅保留舒缓型与脂类补充沐浴油"
      },
      {
        "trigger": "q5 == 'A'",
        "mask": [
          1,
          0,
          0,
          1,
          1,
          0
        ],
        "note": "孕妇/绝对纯净防线：强制清零刺激性酸类（水杨酸/果酸）及香氛型产品，守住母婴安全红线"
      },
      {
        "trigger": "q3 == 'B'",
        "mask": [
          1,
          0,
          1,
          1,
          1,
          1
        ],
        "note": "成分排斥防线：大干皮严禁使用水杨酸控油型"
      },
      {
        "trigger": "q3 == 'A'",
        "mask": [
          1,
          1,
          1,
          1,
          0,
          1
        ],
        "note": "成分排斥防线：大油田严禁使用重度脂类油膏"
      }
    ]
  },
  "profile": {
    "steps": [
      {
        "key": "q1",
        "title": "Q1 当前气候与微环境更接近哪一类？",
        "note": "这一步决定基础背景权重。",
        "options": [
          {
            "value": "A",
            "label": "A. 干燥寒冷",
            "sub": "北方冬季常见，易干裂脱屑",
            "choice_label": "干燥寒冷"
          },
          {
            "value": "B",
            "label": "B. 干燥炎热",
            "sub": "日照强、汗液蒸发快，易发烫紧绷",
            "choice_label": "干燥炎热"
          },
          {
            "value": "C",
            "label": "C. 潮湿闷热",
            "sub": "汗油混合，体感厚重，细菌易滋生",
            "choice_label": "潮湿闷热"
          },
          {
            "value": "D",
            "label": "D. 潮湿寒冷",
            "sub": "阴冷+热水澡常导致过度去脂",
            "choice_label": "潮湿寒冷"
          }
        ]
      },
      {
        "key": "q2",
        "title": "Q2 你的皮肤基础耐受度？",
        "note": "安全优先级最高，选完我们会先做硬过滤。",
        "options": [
          {
            "value": "A",
            "label": "A. 极度敏感",
            "sub": "遇热/摩擦易发红，换季刺痛瘙痒",
            "choice_label": "极度敏感"
          },
          {
            "value": "B",
            "label": "B. 屏障健康",
            "sub": "对多数产品耐受稳定",
            "choice_label": "屏障健康"
          }
        ]
      },
      {
        "key": "q3",
        "title": "Q3 当前油脂与角质状态？",
        "note": "这一步决定洗剂基底与功能主线。",
        "options": [
          {
            "value": "A",
            "label": "A. 出油旺盛",
            "sub": "前胸后背易长痘、午后粘腻",
            "choice_label": "出油旺盛"
          },
          {
            "value": "B",
            "label": "B. 缺油干涩",
            "sub": "像砂纸，洗后不涂会发痒",
            "choice_label": "缺油干涩"
          },
          {
            "value": "C",
            "label": "C. 角质堆积",
            "sub": "鸡皮肤/关节厚茧/暗沉",
            "choice_label": "角质堆积"
          },
          {
            "value": "D",
            "label": "D. 状态正常",
            "sub": "无明显油痘或粗糙痛点",
            "choice_label": "状态正常"
          }
        ]
      },
      {
        "key": "q4",
        "title": "Q4 你更喜欢哪种冲洗肤感？",
        "note": "这一步是肤感修正系数。",
        "options": [
          {
            "value": "A",
            "label": "A. 清爽干脆",
            "sub": "讨厌残留，偏好“嘎吱响”",
            "choice_label": "清爽干脆"
          },
          {
            "value": "B",
            "label": "B. 柔滑滋润",
            "sub": "接受轻膜感，喜欢乳液般包裹",
            "choice_label": "柔滑滋润"
          }
        ]
      },
      {
        "key": "q5",
        "title": "Q5 有没有特殊限制？",
        "note": "这一步用于成分过滤。",
        "options": [
          {
            "value": "A",
            "label": "A. 极致纯净",
            "sub": "备孕/母婴/强排香精场景",
            "choice_label": "极致纯净"
          },
          {
            "value": "B",
            "label": "B. 情绪留香",
            "sub": "希望有高级香氛体验",
            "choice_label": "情绪留香"
          }
        ]
      }
    ]
  }
} as const;

export default data;
