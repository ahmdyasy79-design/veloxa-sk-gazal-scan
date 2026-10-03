// VELOXA & SK GAZAL SCAN
// Subscriber Audit API

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  TelegramClient,
  Api,
} from "telegram";

import { StringSession } from "telegram/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAMPLE_LIMIT = 10;

function getTelegramClient() {
  const apiId = Number(
    process.env.TELEGRAM_API_ID
  );

  const apiHash =
    process.env.TELEGRAM_API_HASH;

  const sessionString =
    process.env.TELEGRAM_SESSION_STRING || "";

  if (!apiId || !apiHash) {
    throw new Error(
      "TELEGRAM_API_ID أو TELEGRAM_API_HASH غير موجودين"
    );
  }

  if (!sessionString) {
    throw new Error(
      "TELEGRAM_SESSION_STRING غير موجود"
    );
  }

  return new TelegramClient(
    new StringSession(sessionString),
    apiId,
    apiHash,
    {
      connectionRetries: 2,
    }
  );
}

function normalizeUsername(
  username: string
) {
  return username
    .trim()
    .replace(
      /^https?:\/\/t\.me\//i,
      ""
    )
    .replace(/^@/, "")
    .replace(/\/+$/, "");
}

function getUserStatus(
  user: any
): string {
  try {
    const className =
      user?.status?.className || "";

    if (
      className.includes(
        "UserStatusOnline"
      )
    ) {
      return "ONLINE";
    }

    if (
      className.includes(
        "UserStatusOffline"
      )
    ) {
      return "OFFLINE";
    }

    if (
      className.includes(
        "UserStatusRecently"
      )
    ) {
      return "RECENTLY";
    }

    if (
      className.includes(
        "UserStatusLastWeek"
      )
    ) {
      return "LAST_WEEK";
    }

    if (
      className.includes(
        "UserStatusLastMonth"
      )
    ) {
      return "LAST_MONTH";
    }

    return "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

function classifyUser(
  user: any
) {
  const deleted =
    user?.deleted === true;

  const bot =
    user?.bot === true;

  let type = "USER";

  if (deleted) {
    type = "DELETED";
  } else if (bot) {
    type = "BOT";
  }

  return {
    type,
    deleted,
    bot,
    status:
      getUserStatus(user),
  };
}

export async function GET(
  request: NextRequest
) {
  let client:
    | TelegramClient
    | null = null;

  try {
    const username =
      request.nextUrl.searchParams.get(
        "username"
      );

    if (!username) {
      return NextResponse.json(
        {
          success: false,
          error:
            "اكتب username للقناة",
        },
        {
          status: 400,
        }
      );
    }

    const cleanUsername =
      normalizeUsername(
        username
      );

    if (!cleanUsername) {
      return NextResponse.json(
        {
          success: false,
          error:
            "اسم القناة غير صحيح",
        },
        {
          status: 400,
        }
      );
    }

    client =
      getTelegramClient();

    await client.connect();

    const entity =
      await client.getEntity(
        cleanUsername
      );

    if (
      !(
        entity instanceof
        Api.Channel
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "الحساب المرسل ليس قناة Telegram",
        },
        {
          status: 400,
        }
      );
    }

    const fullResult =
      await client.invoke(
        new Api.channels.GetFullChannel(
          {
            channel: entity,
          }
        )
      );

    const fullChat =
      fullResult.fullChat as any;

    const subscribers =
      Number(
        fullChat?.participantsCount || 0
      );

    let users: any[] = [];

    try {
      users =
        await client.getParticipants(
          entity,
          {
            limit: SAMPLE_LIMIT,
          }
        );
    } catch (error: any) {
      const errorMessage =
        error?.errorMessage ||
        error?.message ||
        "";

      if (
        String(errorMessage).includes(
          "CHAT_ADMIN_REQUIRED"
        )
      ) {
        return NextResponse.json(
          {
            success: true,

            scanner:
              "VELOXA & SK GAZAL SCAN",

            audit:
              "SUBSCRIBER AUDIT",

            channel: {
              username:
                entity.username ||
                cleanUsername,

              title:
                entity.title ||
                cleanUsername,

              subscribers,

              url:
                `https://t.me/${
                  entity.username ||
                  cleanUsername
                }`,
            },

            memberAudit: {
              available: false,

              reason:
                "Telegram لا يسمح للحساب الحالي بقراءة قائمة أعضاء هذه القناة لأن الحساب ليس Admin.",

              error:
                "CHAT_ADMIN_REQUIRED",

              sampleRequested:
                SAMPLE_LIMIT,

              sampleReceived: 0,
            },

            statisticalAudit: {
              available: true,

              note:
                "يمكن تحليل المشاهدات والتفاعل وسرعة المشاهدات ونسبة المشاهدات إلى المشتركين، لكن هذه المؤشرات لا تثبت وحدها أن المشتركين Fake.",
            },

            scannedAt:
              new Date().toISOString(),
          },
          {
            status: 200,
          }
        );
      }

      throw error;
    }

    let deletedCount = 0;

    let botCount = 0;

    let normalUserCount = 0;

    const statusCounts:
      Record<string, number> = {};

    const sample =
      users.map(
        (user: any) => {
          const result =
            classifyUser(user);

          if (
            result.deleted
          ) {
            deletedCount++;
          } else if (
            result.bot
          ) {
            botCount++;
          } else {
            normalUserCount++;
          }

          statusCounts[
            result.status
          ] =
            (
              statusCounts[
                result.status
              ] || 0
            ) + 1;

          return {
            id:
              user?.id?.toString() ||
              "",

            username:
              user?.username ||
              null,

            firstName:
              user?.firstName ||
              null,

            lastName:
              user?.lastName ||
              null,

            type:
              result.type,

            deleted:
              result.deleted,

            bot:
              result.bot,

            status:
              result.status,
          };
        }
      );

    const sampleSize =
      sample.length;

    const deletedRatio =
      sampleSize > 0
        ? deletedCount /
          sampleSize
        : 0;

    const botRatio =
      sampleSize > 0
        ? botCount /
          sampleSize
        : 0;

    return NextResponse.json(
      {
        success: true,

        scanner:
          "VELOXA & SK GAZAL SCAN",

        audit:
          "SUBSCRIBER AUDIT",

        channel: {
          username:
            entity.username ||
            cleanUsername,

          title:
            entity.title ||
            cleanUsername,

          subscribers,

          url:
            `https://t.me/${
              entity.username ||
              cleanUsername
            }`,
        },

        memberAudit: {
          available: true,

          sampleRequested:
            SAMPLE_LIMIT,

          sampleReceived:
            sampleSize,

          normalUsers:
            normalUserCount,

          deletedUsers:
            deletedCount,

          bots:
            botCount,

          deletedRatio:
            Number(
              (
                deletedRatio * 100
              ).toFixed(2)
            ),

          botRatio:
            Number(
              (
                botRatio * 100
              ).toFixed(2)
            ),
        },

        statusCounts,

        interpretation: {
          note:
            "وجود حسابات Deleted أو Bots مؤشر مباشر على جودة العينة فقط، وليس إثباتًا أن باقي المشتركين Fake.",

          inactive:
            "الحساب Offline لا يعني أنه Fake.",

          statistical:
            "الحكم النهائي يجب أن يعتمد على عدة مؤشرات معًا، وليس على مؤشر واحد.",
        },

        sampleUsers:
          sample,

        scannedAt:
          new Date().toISOString(),
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (
    error: any
  ) {
    console.error(
      "SUBSCRIBER_AUDIT_ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error?.message ||
          "حدث خطأ أثناء فحص أعضاء القناة",

        scanner:
          "VELOXA & SK GAZAL SCAN",

        time:
          new Date().toISOString(),
      },
      {
        status: 500,
      }
    );
  } finally {
    try {
      if (client) {
        await client.disconnect();
      }
    } catch {
      // ignore
    }
  }
}