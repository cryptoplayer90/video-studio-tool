export const BUILTIN_PROVIDER = {
  "schemaVersion": 1,
  "name": "A6API · 2026-10-29 预设",
  "snapshotDate": "2026-10-29",
  "idempotency": false,
  "fields": {
    "seconds": "seconds",
    "resolution": "resolution",
    "audio": "generate_audio",
    "image": "input_reference",
    "video": "reference_videos"
  },
  "models": [
    {
      "id": "doubao-seedance-2.5",
      "brand": "字节跳动 · Seedance",
      "seconds": {
        "default": 5,
        "max": 30
      },
      "resolutions": [
        "1080p",
        "480p",
        "720p"
      ],
      "audio": false,
      "media": {
        "image": null,
        "video": null
      },
      "specKeys": [
        "1080p|any|no",
        "1080p|any|yes",
        "480p|any|no",
        "480p|any|yes",
        "720p|any|no",
        "720p|any|yes"
      ],
      "source": "本地配置"
    },
    {
      "id": "doubao-seedance-2.0",
      "brand": "字节跳动 · Seedance",
      "seconds": {
        "default": 5,
        "max": 15
      },
      "resolutions": [
        "1080p",
        "480p",
        "4k",
        "720p"
      ],
      "audio": false,
      "media": {
        "image": null,
        "video": null
      },
      "specKeys": [
        "1080p|any|no",
        "1080p|any|yes",
        "480p|any|no",
        "480p|any|yes",
        "4k|any|no",
        "4k|any|yes",
        "720p|any|no",
        "720p|any|yes"
      ],
      "source": "本地配置"
    },
    {
      "id": "doubao-seedance-2.0-fast",
      "brand": "字节跳动 · Seedance",
      "seconds": {
        "default": 5,
        "max": 15
      },
      "resolutions": [
        "480p",
        "720p"
      ],
      "audio": false,
      "media": {
        "image": null,
        "video": null
      },
      "specKeys": [
        "480p|any|no",
        "480p|any|yes",
        "720p|any|no",
        "720p|any|yes"
      ],
      "source": "本地配置"
    },
    {
      "id": "doubao-seedance-2.0-mini",
      "brand": "字节跳动 · Seedance",
      "seconds": {
        "default": 5,
        "max": 15
      },
      "resolutions": [
        "480p",
        "720p"
      ],
      "audio": false,
      "media": {
        "image": null,
        "video": null
      },
      "specKeys": [
        "480p|any|no",
        "480p|any|yes",
        "720p|any|no",
        "720p|any|yes"
      ],
      "source": "本地配置"
    },
    {
      "id": "kling-2.6",
      "brand": "可灵 · Kling",
      "seconds": {
        "default": 5,
        "max": 10
      },
      "resolutions": [
        "1080p",
        "720p"
      ],
      "audio": true,
      "media": {
        "image": null,
        "video": null
      },
      "specKeys": [
        "1080p|off|any",
        "1080p|on|any",
        "720p|off|any"
      ],
      "source": "本地配置"
    },
    {
      "id": "kling-3.0",
      "brand": "可灵 · Kling",
      "seconds": {
        "default": 5,
        "max": 15
      },
      "resolutions": [
        "1080p",
        "4k",
        "720p"
      ],
      "audio": true,
      "media": {
        "image": null,
        "video": null
      },
      "specKeys": [
        "1080p|off|any",
        "1080p|on|any",
        "4k|off|any",
        "4k|on|any",
        "720p|off|any",
        "720p|on|any"
      ],
      "source": "本地配置"
    },
    {
      "id": "kling-3.0-omni",
      "brand": "可灵 · Kling",
      "seconds": null,
      "resolutions": [
        "1080p",
        "4k",
        "720p"
      ],
      "audio": true,
      "media": {
        "image": null,
        "video": null
      },
      "specKeys": [
        "1080p|off|no",
        "1080p|off|yes",
        "1080p|on|no",
        "4k|off|no",
        "4k|off|yes",
        "4k|on|no",
        "720p|off|no",
        "720p|off|yes",
        "720p|on|no"
      ],
      "source": "本地配置"
    },
    {
      "id": "kling-3.0-turbo",
      "brand": "可灵 · Kling",
      "seconds": {
        "default": 5,
        "max": 15
      },
      "resolutions": [
        "1080p",
        "720p"
      ],
      "audio": null,
      "media": {
        "image": null,
        "video": null
      },
      "specKeys": [
        "1080p|any|any",
        "720p|any|any"
      ],
      "source": "本地配置"
    },
    {
      "id": "kling-4",
      "brand": "可灵 · Kling",
      "seconds": null,
      "resolutions": [
        "1080p",
        "720p"
      ],
      "audio": null,
      "media": {
        "image": null,
        "video": null
      },
      "specKeys": [
        "1080p|any|no",
        "1080p|any|yes",
        "720p|any|no",
        "720p|any|yes"
      ],
      "source": "本地配置"
    },
    {
      "id": "kling-video-o1",
      "brand": "可灵 · Kling",
      "seconds": null,
      "resolutions": [
        "1080p",
        "720p"
      ],
      "audio": null,
      "media": {
        "image": null,
        "video": null
      },
      "specKeys": [
        "1080p|any|no",
        "1080p|any|yes",
        "720p|any|no",
        "720p|any|yes"
      ],
      "source": "本地配置"
    },
    {
      "id": "gemini-omni-1.1-flash",
      "brand": "Google",
      "seconds": null,
      "resolutions": [
        "720p"
      ],
      "audio": null,
      "media": {
        "image": null,
        "video": null
      },
      "specKeys": [
        "720p|any|any"
      ],
      "source": "本地配置"
    },
    {
      "id": "veo-3.1",
      "brand": "Google",
      "seconds": {
        "default": 8,
        "max": 8
      },
      "resolutions": [
        "1080p",
        "4k",
        "720p"
      ],
      "audio": null,
      "media": {
        "image": null,
        "video": null
      },
      "specKeys": [
        "1080p|any|any",
        "4k|any|any",
        "720p|any|any"
      ],
      "source": "本地配置"
    },
    {
      "id": "veo-3.1-fast",
      "brand": "Google",
      "seconds": {
        "default": 8,
        "max": 8
      },
      "resolutions": [
        "1080p",
        "4k",
        "720p"
      ],
      "audio": null,
      "media": {
        "image": null,
        "video": null
      },
      "specKeys": [
        "1080p|any|any",
        "4k|any|any",
        "720p|any|any"
      ],
      "source": "本地配置"
    },
    {
      "id": "veo-3.1-lite",
      "brand": "Google",
      "seconds": {
        "default": 8,
        "max": 8
      },
      "resolutions": [
        "1080p",
        "720p"
      ],
      "audio": null,
      "media": {
        "image": null,
        "video": null
      },
      "specKeys": [
        "1080p|any|any",
        "720p|any|any"
      ],
      "source": "本地配置"
    },
    {
      "id": "grok-imagine-video-1.5",
      "brand": "xAI · Grok",
      "seconds": {
        "default": 8,
        "max": 15
      },
      "resolutions": [
        "1080p",
        "480p",
        "720p"
      ],
      "audio": null,
      "media": {
        "image": null,
        "video": null
      },
      "specKeys": [
        "1080p|any|any",
        "480p|any|any",
        "720p|any|any"
      ],
      "source": "本地配置"
    },
    {
      "id": "minimax-h3",
      "brand": "MiniMax",
      "seconds": {
        "default": 5,
        "max": 15
      },
      "resolutions": [
        "2k",
        "720p"
      ],
      "audio": null,
      "media": {
        "image": null,
        "video": null
      },
      "specKeys": [
        "2k|any|no",
        "2k|any|yes",
        "720p|any|no",
        "720p|any|yes"
      ],
      "source": "本地配置"
    },
    {
      "id": "viduq3-pro",
      "brand": "Vidu",
      "seconds": {
        "default": 5,
        "max": 16
      },
      "resolutions": [
        "1080p",
        "480p",
        "720p"
      ],
      "audio": null,
      "media": {
        "image": null,
        "video": null
      },
      "specKeys": [
        "1080p|any|any",
        "480p|any|any",
        "720p|any|any"
      ],
      "source": "本地配置"
    },
    {
      "id": "viduq3-turbo",
      "brand": "Vidu",
      "seconds": {
        "default": 5,
        "max": 16
      },
      "resolutions": [
        "1080p",
        "480p",
        "720p"
      ],
      "audio": null,
      "media": {
        "image": null,
        "video": null
      },
      "specKeys": [
        "1080p|any|any",
        "480p|any|any",
        "720p|any|any"
      ],
      "source": "本地配置"
    },
    {
      "id": "happyhorse-1.1",
      "brand": "阿里巴巴",
      "seconds": null,
      "resolutions": [
        "1080p",
        "480p",
        "720p"
      ],
      "audio": null,
      "media": {
        "image": null,
        "video": null
      },
      "specKeys": [
        "1080p|any|any",
        "480p|any|any",
        "720p|any|any"
      ],
      "source": "本地配置"
    },
    {
      "id": "wan3.0-video",
      "brand": "阿里巴巴",
      "seconds": {
        "default": 5,
        "max": 30
      },
      "resolutions": [
        "1080p",
        "480p",
        "720p"
      ],
      "audio": null,
      "media": {
        "image": null,
        "video": null
      },
      "specKeys": [
        "1080p|any|no",
        "1080p|any|yes",
        "480p|any|no",
        "480p|any|yes",
        "720p|any|no",
        "720p|any|yes"
      ],
      "source": "本地配置"
    },
    {
      "id": "wan3.0-video-prime",
      "brand": "阿里巴巴",
      "seconds": null,
      "resolutions": [
        "1080p",
        "480p",
        "720p"
      ],
      "audio": null,
      "media": {
        "image": null,
        "video": null
      },
      "specKeys": [
        "1080p|any|no",
        "1080p|any|yes",
        "480p|any|no",
        "480p|any|yes",
        "720p|any|no",
        "720p|any|yes"
      ],
      "source": "本地配置"
    }
  ]
};
