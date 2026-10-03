import { NextResponse } from "next/server";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";

import { analyzeChannel } from "@/engine/analyzers/channel-analyzer";
import { analyzeReality } from "@/engine/analyzers/reality-audit";
import type { PostData } from "@/engine/rules/view-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyRecord = Record<string, any>;

function jsonError(
  message: string,
  status = 500,
  details?: unknown
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      details:
        details instanceof Error
          ? details.message
          : details ?? null,
    },
    { status }
  );
}

function safeNumber(value: unknown): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return Math.max(0, value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }

  return 0;
}

function normalizeTelegramDate(
  value: unknown
): Date | null {
  if (value instanceof Date) {
    const time = value.getTime();

    return Number.isFinite(time)
      ? value
      : null;
  }

  if (typeof value === "number") {
    if (
      !Number.isFinite(value) ||
      value <= 0
    ) {
      return null;
    }

    const milliseconds =
      value < 100_000_000_000
        ? value * 1000
        : value;

    const date =
      new Date(milliseconds);

    return Number.isFinite(
      date.getTime()
    )
      ? date
      : null;
  }

  if (typeof value === "string") {
    const numericValue =
      Number(value);

    if (
      Number.isFinite(
        numericValue
      ) &&
      numericValue > 0
    ) {
      const milliseconds =
        numericValue <
        100_000_000_000
          ? numericValue * 1000
          : numericValue;

      const date =
        new Date(milliseconds);

      if (
        Number.isFinite(
          date.getTime()
        )
      ) {
        return date;
      }
    }

    const parsed =
      new Date(value);

    return Number.isFinite(
      parsed.getTime()
    )
      ? parsed
      : null;
  }

  return null;
}

function getReactionCount(
  message: AnyRecord
): number {
  const results =
    message?.reactions?.results;

  if (
    !Array.isArray(results)
  ) {
    return 0;
  }

  return results.reduce(
    (
      total: number,
      item: AnyRecord
    ) =>
      total +
      safeNumber(
        item?.count
      ),
    0
  );
}

function getSubscriberCount(
  entity: AnyRecord
): number {
  const directValues = [
    entity?.participantsCount,
    entity?.participants_count,
    entity?.membersCount,
    entity?.members_count,
    entity?.subscribers,
  ];

  for (
    const value of directValues
  ) {
    const count =
      safeNumber(value);

    if (count > 0) {
      return count;
    }
  }

  const fullChat =
    entity?.fullChat ??
    entity?.full_chat;

  if (fullChat) {
    const fullChatValues = [
      fullChat?.participantsCount,
      fullChat?.participants_count,
      fullChat?.membersCount,
      fullChat?.members_count,
    ];

    for (
      const value of fullChatValues
    ) {
      const count =
        safeNumber(value);

      if (count > 0) {
        return count;
      }
    }
  }

  return 0;
}

async function resolveSubscriberCount(
  client: TelegramClient,
  entity: AnyRecord
): Promise<number> {
  const direct =
    getSubscriberCount(
      entity
    );

  if (direct > 0) {
    return direct;
  }

  try {
    const inputChannel =
      await client.getInputEntity(
        entity as any
      );

    const full =
      await client.invoke(
        new Api.channels.GetFullChannel({
          channel:
            inputChannel as any,
        })
      );

    const fullRecord =
      full as AnyRecord;

    const fullChat =
      fullRecord?.fullChat ??
      fullRecord?.full_chat;

    const count =
      getSubscriberCount({
        ...fullRecord,
        fullChat,
      });

    if (count > 0) {
      return count;
    }
  } catch (error) {
    console.warn(
      "SUBSCRIBER COUNT FALLBACK FAILED:",
      error instanceof Error
        ? error.message
        : error
    );
  }

  return 0;
}

function getChannelTitle(
  entity: AnyRecord,
  username: string
): string {
  return (
    entity?.title ||
    entity?.name ||
    username
  );
}

function cleanUsername(
  value: unknown
): string {
  return String(value ?? "")
    .trim()
    .replace(/^@/, "");
}

export async function POST(
  request: Request
) {
  let client:
    | TelegramClient
    | null = null;

  try {
    // =========================================================
    // REQUEST
    // =========================================================

    let body: AnyRecord = {};

    try {
      body =
        await request.json();
    } catch {
      return jsonError(
        "Invalid JSON request.",
        400
      );
    }

    const channelUsername = cleanUsername(body?.username); console.log("CHANNEL RECEIVED:", JSON.stringify(channelUsername));

    if (!channelUsername) {
      return jsonError(
        "Channel username is required.",
        400
      );
    }

    // =========================================================
    // ENV
    // =========================================================

    const apiIdText =
      process.env.TELEGRAM_API_ID;

    const apiHash =
      process.env.TELEGRAM_API_HASH;

    const sessionString =
      process.env.TELEGRAM_SESSION_STRING;

    if (!apiIdText) {
      return jsonError(
        "TELEGRAM_API_ID is missing."
      );
    }

    if (!apiHash) {
      return jsonError(
        "TELEGRAM_API_HASH is missing."
      );
    }

    if (!sessionString) {
      return jsonError(
        "TELEGRAM_SESSION_STRING is missing."
      );
    }

    const apiId =
      Number(apiIdText);

    if (
      !Number.isInteger(apiId) ||
      apiId <= 0
    ) {
      return jsonError(
        "TELEGRAM_API_ID is invalid."
      );
    }

    // =========================================================
    // TELEGRAM
    // =========================================================

    const stringSession =
      new StringSession(
        sessionString
      );

    client =
      new TelegramClient(
        stringSession,
        apiId,
        apiHash,
        {
          connectionRetries: 3,
        }
      );

    await client.connect();

    // =========================================================
    // CHANNEL
    // =========================================================

    const entity =
      await client.getEntity(
        channelUsername
      );

    if (!entity) {
      return jsonError(
        "Telegram channel was not found.",
        404
      );
    }

    const entityRecord =
      entity as AnyRecord;

    const title =
      getChannelTitle(
        entityRecord,
        channelUsername
      );

    // =========================================================
    // SUBSCRIBERS
    // =========================================================

    const subscribers =
      await resolveSubscriberCount(
        client,
        entityRecord
      );

    // =========================================================
    // POSTS
    // =========================================================

    const messages =
      await client.getMessages(
        entity,
        {
          limit: 20,
        }
      );

    const now =
      new Date();

    const posts: PostData[] =
      [];

    for (
      const message of messages
    ) {
      const messageRecord =
        message as AnyRecord;

      const publishedDate =
        normalizeTelegramDate(
          messageRecord?.date
        );

      if (!publishedDate) {
        continue;
      }

      const views =
        safeNumber(
          messageRecord?.views
        );

      const reactions =
        getReactionCount(
          messageRecord
        );

      const forwards =
        safeNumber(
          messageRecord?.forwards
        );

      const replies =
        safeNumber(
          messageRecord?.replies
            ?.replies
        );

      const ageSeconds =
        Math.max(
          0,
          Math.floor(
            (
              now.getTime() -
              publishedDate.getTime()
            ) / 1000
          )
        );

      const ageMinutes =
        Math.max(
          ageSeconds / 60,
          1 / 60
        );

      const viewsPerMinute =
        views /
        ageMinutes;

      posts.push({
        id: String(messageRecord?.id ?? ""),

        publishedAt:
          publishedDate.toISOString(),

        ageSeconds,

        views,

        viewsPerMinute,

        reactions,

        forwards,

        replies,      });
    }

    posts.sort(
      (
        a,
        b
      ) =>
        new Date(
          a.publishedAt
        ).getTime() -
        new Date(
          b.publishedAt
        ).getTime()
    );

    // =========================================================
    // QUALITY ANALYSIS
    // =========================================================

    const analysis =
      analyzeChannel(
        {
          username:
            channelUsername,

          title,

          subscribers,

          posts,
        },
        now
      );

    // =========================================================
    // REALITY AUDIT
    // =========================================================

    const realityAudit =
      analyzeReality({
        subscribers,

        posts:
          posts.map(
            (post) => ({
              views:
                post.views,

              reactions:
                post.reactions,

              forwards:
                post.forwards,

              replies:
                post.replies,

              publishedAt:
                post.publishedAt,
            })
          ),
      });

    // =========================================================
    // RESPONSE
    // =========================================================

    return NextResponse.json(
      {
        success: true,

        username:
          channelUsername,

        title,

        subscribers,

        posts,

        analysis,

        realityAudit,

        meta: {
          postsRequested: 20,

          postsAnalyzed:
            posts.length,

          checkedAt:
            now.toISOString(),

          telegramConnected:
            true,

          subscriberCountSource:
            subscribers > 0
              ? "telegram"
              : "unavailable",
        },
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error: any) {
    console.error(
      "CHANNEL SCAN ERROR:",
      error
    );

    return jsonError(
      error?.message ||
        "Channel scan failed.",
      500
    );
  } finally {
    try {
      if (client) {
        await client.disconnect();
      }
    } catch {
      // Ignore disconnect errors.
    }
  }
}

export async function GET() {
  return NextResponse.json(
    {
      success: true,

      service:
        "VELOXA & SK GAZAL SCAN",

      endpoint:
        "/api/channel-scan",

      status:
        "online",

      method:
        "POST",
    },
    {
      status: 200,

      headers: {
        "Cache-Control":
          "no-store",
      },
    }
  );
}






