const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");

async function main() {
  console.log("\n====================================");
  console.log(" VELOXA & SK GAZAL SCAN");
  console.log(" Telegram Session Generator");
  console.log("====================================\n");

  const apiIdText = await input.text(
    "Telegram API ID: "
  );

  const apiId = Number(apiIdText.trim());

  if (!apiId || !Number.isInteger(apiId)) {
    throw new Error(
      "API ID غير صحيح."
    );
  }

  const apiHash = (
    await input.text(
      "Telegram API Hash: "
    )
  ).trim();

  if (!apiHash) {
    throw new Error(
      "API Hash مطلوب."
    );
  }

  const phoneNumber = (
    await input.text(
      "رقم Telegram مع كود الدولة: "
    )
  ).trim();

  if (!phoneNumber) {
    throw new Error(
      "رقم الهاتف مطلوب."
    );
  }

  const stringSession =
    new StringSession("");

  const client =
    new TelegramClient(
      stringSession,
      apiId,
      apiHash,
      {
        connectionRetries: 5,
      }
    );

  console.log(
    "\nجاري الاتصال بـ Telegram...\n"
  );

  await client.start({
    phoneNumber: async () => phoneNumber,

    password: async () => {
      return await input.text(
        "كلمة مرور التحقق بخطوتين: "
      );
    },

    phoneCode: async () => {
      return await input.text(
        "كود Telegram الذي وصلك: "
      );
    },

    onError: (error) => {
      console.error(
        "\nTelegram Error:",
        error.message || error
      );
    },
  });

  console.log(
    "\n===================================="
  );

  console.log(
    "تم تسجيل الدخول بنجاح ✅"
  );

  console.log(
    "====================================\n"
  );

  const session =
    client.session.save();

  console.log(
    "SESSION STRING:"
  );

  console.log(
    session
  );

  console.log(
    "\n===================================="
  );

  console.log(
    "انسخ Session String وضعه في .env.local"
  );

  console.log(
    "ولا ترسله لأي شخص."
  );

  console.log(
    "====================================\n"
  );

  await client.disconnect();
}

main().catch((error) => {
  console.error(
    "\nفشل تسجيل الدخول:"
  );

  console.error(
    error?.message || error
  );

  process.exit(1);
});