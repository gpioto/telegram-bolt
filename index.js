const Telegraf = require('telegraf')
const Extra = require('telegraf/extra')
const Markup = require('telegraf/markup')
const _ = require('lodash')
let db = {}

const bot = new Telegraf(process.env.BOT_TOKEN)
bot.start((ctx) => ctx.reply(`Parabéns ${ctx.from.first_name} e seja Bem Vindo ao Bolt!
O que você quer ganhar no amigo álcool?`));

bot.on('message', (ctx) => {
    db[ctx.chat.username] = ctx.message.text
    ctx.reply(`Parabens, voce escolheu ${ctx.message.text}`)
})

bot.hears('debug', ctx => {
    ctx.reply(JSON.stringify(db))
})

bot.command('sortear', ctx => {
    const chatId = ctx.chat.id;

    if(ctx.chat.type == 'private') {
        ctx.reply('Esse comando é pra ser rodado num grupo!');
        return;
    }

    ctx.reply('Sorteando, segura essa emoção aí!');

    bot.telegram.getChatAdministrators(chatId).then(admins => {
        const users = admins.map(admin => admin.user);
        const length = users.length;
        const shuffled = _.shuffle(users);
        let promises = []
        for (let i = 0; i < length; i++) {
            const next = shuffled[(i + 1) % length];
            promises.push(
                bot.telegram.sendMessage(
                    shuffled[i].id,
                    `Você tirou ${next.first_name} (@${next.username}). E essa pessoa quer ${db[next.username]}`
                )
            );
        }
        Promise.all(promises).then(
            values => ctx.reply('Sorteado com sucesso! Viu saporra funciona'),
            reason => ctx.reply('Tem nego que ainda não conversou comigo, essa não valeu')
        )
    }).catch( err => {
        ctx.reply('DEU RUIM!');
        ctx.reply(err);
    });
})

bot.command('quemfalta', ctx => {
    bot.telegram.getChatAdministrators(ctx.chat.id).then(admins => {

        Promise.all(admins.map(admin => {
            return new Promise((resolve, reject) => {
                bot.telegram.sendMessage(admin.user.id, 'Bora?')
                .then(result => resolve(null))
                .catch(reason => resolve(admin.user));
            })

        })).then(users => {
            const allUsers = users.filter(user => user != null);
            if (allUsers.length > 0) {
                const userNames = allUsers.map(user => `${user.first_name} (@${user.username})`).join();

                ctx.reply('Falta essas feras aí meu, olhaaa: ' + userNames);
            } else {
                ctx.reply('Não falta ninguém :D, agora é só /sortear')
            }
        }).catch(console.error);
    })
})
bot.startPolling()

//Heroku needs to bind to a port
const http = require('http');
http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello Node.JS!');
}).listen(process.env.PORT || 5000);