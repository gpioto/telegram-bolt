"useStrict";

const _ = require("lodash");
const TelegramBot = require("node-telegram-bot-api");
const { query: q, Client } = require("faunadb");

const bot = new TelegramBot(process.env.BOT_TOKEN);
const client = new Client({
  secret: process.env.FAUNA_SECRET,
  domain: "db.us.fauna.com",
  port: 443,
  scheme: "https",
});

async function wantsHandler(chat, matched) {
  if (chat.type !== "private") {
    return bot.sendMessage(
      chat.id,
      "Esse comando é pra ser rodado no privado!"
    );
  }

  const match = q.Match(q.Index("user_by_username"), chat.username);
  const data = { username: chat.username, gift: matched[1] };

  const payload = { data: q.Var("data") };

  const condition = q.If(
    q.Exists(q.Var("match")),
    q.Update(q.Select("ref", q.Get(q.Var("match"))), payload),
    q.Create(q.Collection("users"), payload)
  );

  await client.query(q.Let({ match, data }, condition));

  return bot.sendMessage(chat.id, `Parabéns, você escolheu ${matched[1]}`);
}

async function validateGifts(chat) {
  await bot.sendMessage(chat.id, "Validando...");

  const resultQuery = q.Map(
    q.Paginate(q.Documents(q.Collection("users"))),
    q.Lambda((ref) =>
      q.Let({ user: q.Get(ref) }, [
        q.Select(["data", "username"], q.Var("user")),
        q.Select(["data", "gift"], q.Var("user")),
      ])
    )
  );

  const [admins, gifts] = await Promise.all([
    bot.getChatAdministrators(chat.id),
    client.query(q.ToObject(q.Select("data", resultQuery))),
  ]);

  const users = admins.map((admin) => admin.user).filter(user => !user.is_bot);

  const missingUsers = users.filter((user) => !gifts[user.username]);

  const missing = missingUsers.map((u) => `${u.first_name} (@${u.username})`);

  if (missingUsers.length) {
    await bot.sendMessage(chat.id, `Ainda faltam ${missing.join(", ")}`);
    return;
  }

  return users;
}

async function sortHandler(chat) {
  if (chat.type == "private") {
    return bot.sendMessage(chat.id, "Esse comando é pra ser rodado num grupo!");
  }

  const users = await validateGifts(chat);

  if (!users) return;

  await bot.sendMessage(chat.id, "Sorteando...");

  const shuffled = _.shuffle(users);

  const promises = shuffled.map((current, i) => {
    const { first_name, username } = shuffled[(i + 1) % users.length];
    const message = `Você tirou ${first_name} (@${username}). E essa pessoa quer ${gifts[username]}`;
    return bot.sendMessage(current.id, message);
  });

  return Promise.all(promises).then(
    () => bot.sendMessage(chat.id, "Sorteado com sucesso!"),
    () => bot.sendMessage(chat.id, "Algo de errado não está certo")
  );
}

function whosMissingHandler(chat) {
  if (chat.type == "private") {
    return bot.sendMessage(chat.id, "Esse comando é pra ser rodado num grupo!");
  }

  return validateGifts(chat);
}

const handlers = {
  "/quemfalta": whosMissingHandler,
  "/quero (.+)": wantsHandler,
  "/sortear": sortHandler,
};

async function handleMessage(message) {
  for (const [regex, handler] of Object.entries(handlers)) {
    const match = message.text.match(regex);
    if (match) {
      await handler(message.chat, match);
      return true;
    }
  }
  return false;
}

module.exports = async (request, response) => {
  try {
    if (request.body.message) {
      const success = await handleMessage(request.body.message);
      if (!success) {
        console.log("desconhecido");
        bot.sendMessage(message.chat.id, "Comando desconhecido");
      }
    }
  } catch (error) {
    console.error(error.toString());
  }
  response.send("OK");
};
