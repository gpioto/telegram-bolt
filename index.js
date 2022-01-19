const { Telegraf } = require("telegraf");
const _ = require("lodash");
let db = {};

const bot = new Telegraf(process.env.BOT_TOKEN);
bot.start((ctx) =>
  ctx.reply(`Parabéns ${ctx.from.first_name} e seja Bem Vindo ao Bolt!
O que você quer ganhar no amigo álcool? Use o comando /quero Ex.: /quero Cerveja `)
);

bot.hears(/\/quero (.+)/, (ctx) => {
  if (ctx.chat.type != "private") {
    ctx.reply("Esse comando é pra ser rodado no privado!");
    return;
  }

  db[ctx.chat.username] = ctx.match[1];
  ctx.reply(`Parabens, voce escolheu ${ctx.match[1]}`);
});

bot.command("debug", (ctx) => {
  if (ctx.chat.type != "private") {
    ctx.reply("Esse comando é pra ser rodado no privado!");
    return;
  }
  ctx.reply(JSON.stringify(db));
});

bot.command("sortear", (ctx) => {
  const chatId = ctx.chat.id;

  if (ctx.chat.type == "private") {
    ctx.reply("Esse comando é pra ser rodado num grupo!");
    return;
  }

  ctx.reply("Sorteando, segura essa emoção aí!");

  bot.telegram
    .getChatAdministrators(chatId)
    .then((admins) => {
      const users = admins.map((admin) => admin.user);
      const length = users.length;
      const shuffled = _.shuffle(users);
      let promises = [];
      for (let i = 0; i < length; i++) {
        const next = shuffled[(i + 1) % length];
        const message = `Você tirou ${next.first_name} (@${
          next.username
        }). E essa pessoa quer ${db[next.username]}`;
        promises.push(bot.telegram.sendMessage(shuffled[i].id, message));
      }
      Promise.all(promises).then(
        () => ctx.reply("Sorteado com sucesso! Viu saporra funciona"),
        () =>
          ctx.reply("Tem nego que ainda não conversou comigo, essa não valeu")
      );
    })
    .catch((err) => {
      ctx.reply("DEU RUIM!");
      ctx.reply(err);
    });
});

bot.command("quemfalta", (ctx) => {
  bot.telegram.getChatAdministrators(ctx.chat.id).then((admins) => {
    Promise.all(
      admins.map((admin) => {
        return new Promise((resolve, reject) => {
          bot.telegram
            .sendMessage(admin.user.id, "Bora?")
            .then((result) => resolve(null))
            .catch((reason) => resolve(admin.user));
        });
      })
    )
      .then((users) => {
        const allUsers = users.filter((user) => user != null);
        if (allUsers.length > 0) {
          const userNames = allUsers
            .map((user) => `${user.first_name} (@${user.username})`)
            .join();

          ctx.reply("Falta essas feras aí meu, olhaaa: " + userNames);
        } else {
          ctx.reply("Não falta ninguém :D, agora é só /sortear");
        }
      })
      .catch(console.error);
  });
});
bot.startPolling();

//Heroku needs to bind to a port
const http = require("http");
http
  .createServer(function (req, res) {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Hello Node.JS!");
  })
  .listen(process.env.PORT || 5000);
