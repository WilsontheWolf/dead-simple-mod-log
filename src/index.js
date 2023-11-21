import { Base, Client, Constants, Message } from '@projectdysnomia/dysnomia';
import { readFile } from 'fs/promises';


let token = process.env.TOKEN;
const modChannel = process.env.LOG_CHANNEL;

if (!token) {
    console.error('No token found! Make sure the TOKEN env is set. Exiting...');
    process.exit(1);
}

if (!modChannel) {
	console.error('No log channel found! Make sure the LOG_CHANNEL env is set. Exiting...');
    process.exit(1);
	
}

if (!token.startsWith('Bot ')) {
    token = `Bot ${token}`;
}

const client = new Client(token, {
    gateway: {
        intents: [
            'guilds',
            'guildMessages',
            "messageContent",
        ]
    }
});

client.on('ready', () => {
    console.log(`Ready as ${client.user.username}#${client.user.discriminator}`);
    client.editStatus('online', {
        name: 'Super Cool Bot',
        type: Constants.ActivityTypes.CUSTOM,
        state: 'Super Cool Bot',
    });
});

client.on('messageDelete', async (message) => {
    try {
        /**
         * @type {import('@projectdysnomia/dysnomia').TextChannel}
         */
        const channel = client.getChannel(modChannel);
        if (!channel || channel.type !== Constants.ChannelTypes.GUILD_TEXT) {
            console.error(`Could not find mod channel, or it is not a text channel. (${modChannel})`);
        }
        if(message.guildID !== channel.guild.id) {
            return;
        }

        if (!(message instanceof Message)) {
            return channel.createMessage({
                embeds: [{
                    title: 'Message Deleted',
                    description: `An uncached message by ${message.author ? `<@${message.author.id}>` : 'an unknown user'} was deleted in <#${message.channel.id}>.\nContent could not be shown.`,
                    color: 0xff0000,
                }]
            });
        }

        const content = {
            text: message.content,
            embeds: message.embeds,
            attachments: message.attachments,
            reference: message.referencedMessage
        };

        if (!content.text && !content.embeds.length && !content.attachments.size) {
            return;
        }

        /**
         * @type {import('@projectdysnomia/dysnomia').EmbedOptions[]}
         */
        const embeds = [{
            title: 'Message Deleted',
            description: `A message by <@${message.author.id}> was deleted in <#${message.channel.id}>:\n${content.text ?? ''}`, // Note this message before the user content can't exceed 96 characters
            color: 0xff0000,
            fields: [],
            timestamp: new Date(message.createdAt),
        }];

        if (content.reference) {
            if (message.type === Constants.MessageTypes.REPLY) {
                embeds[0].fields.push({
                    name: 'Replying To',
                    value: `[${content.reference.author.username}#${content.reference.author.discriminator}](${content.reference.jumpLink})`,
                });
            }
        }

        if (content.embeds.length) {
            embeds[0].fields.push({
                name: 'Embeds',
                value: `${content.embeds.length} embeds`,
            });
        }
        if (content.attachments.size) {
            embeds[0].fields.push({
                name: 'Attachments',
                value: `${content.attachments.size} attachments:\n${content.attachments.map(a => `[${a.filename}](${a.url})`).join('\n')}`,
            });
        }

        await channel.createMessage({
            embeds,
        });
    } catch (e) {
        console.error(e);
    }
});

client.on('messageUpdate', async (message, oldMessage) => {
    try {
        /**
         * @type {import('@projectdysnomia/dysnomia').TextChannel}
         */
        const channel = client.getChannel(modChannel);
        if (!channel || channel.type !== Constants.ChannelTypes.GUILD_TEXT) {
            console.error(`Could not find mod channel, or it is not a text channel. (${modChannel})`);
        }
        if (message.guildID !== channel.guild.id) {
            return;
        }

        if (!oldMessage) {
            if (Date.now() - (message.editedTimestamp ?? 0) > 60000) { // Not "edited" in the past minute
                return;
            }
            return channel.createMessage({
                embeds: [{
                    title: 'Message Edited',
                    description: `An uncached message by ${message.author ? `<@${message.author.id}>` : 'an unknown user'} was edited in <#${message.channel.id}>.\nChanges could not be shown.`,
                    color: 0x0000ff,
                    url: message.jumpLink,
                    timestamp: new Date(message.editedTimestamp),
                }]
            });
        }

        const diffContent = {};
        if (message.content !== oldMessage.content) {
            diffContent.text = {
                old: oldMessage.content,
                new: message.content,
            };
        }
        if (message.attachments.size !== oldMessage.attachments.size) {
            diffContent.attachments = {
                old: oldMessage.attachments,
                new: message.attachments,
            };
        } else if (message.attachments.size) {
            let diff = false;
            for (const key of message.attachments.keys()) {
                if (!oldMessage.attachments.find((v) => v.id === key)) {
                    diff = true;
                    break;
                }
            }
            if (diff) {
                diffContent.attachments = {
                    old: oldMessage.attachments,
                    new: message.attachments,
                };
            }
        }
        if (Object.keys(diffContent).length === 0) {
            return;
        }

        /**
         * @type {import('@projectdysnomia/dysnomia').EmbedOptions[]}
         */
        const embeds = [{
            title: 'Message Edited',
            description: `A message by <@${message.author.id}> was edited in <#${message.channel.id}>.`,
            color: 0x0000ff,
            fields: [],
            timestamp: new Date(message.editedTimestamp ?? 0),
            url: message.jumpLink,
        }];

        if (diffContent.text) {
            embeds.push({
                title: 'Old Content',
                description: diffContent.text.old,
            })
            embeds.push({
                title: 'New Content',
                description: diffContent.text.new,
            })
        }
        if (diffContent.attachments) {
            let text = '';
            const seen = [];
            diffContent.attachments.old.forEach((a) => {
                if (!diffContent.attachments.new.has(a.id)) {
                    text += `[${a.filename}](${a.url}) - Removed\n`;
                }
                seen.push(a.id);
            });
            diffContent.attachments.new.forEach((a) => {
                if (!seen.includes(a.id)) {
                    text += `[${a.filename}](${a.url}) - Added\n`;
                }
            });
            if (text) {
                embeds[0].fields.push({
                    name: 'Attachments',
                    value: text,
                });
            }
        }
        await channel.createMessage({
            embeds,
        });
    } catch (e) {
        console.error(e);
    }
});

client.on('messageDeleteBulk', async (messages) => {
    try {
        /**
         * @type {import('@projectdysnomia/dysnomia').TextChannel}
         */
        const channel = client.getChannel(modChannel);
        if (!channel || channel.type !== Constants.ChannelTypes.GUILD_TEXT) {
            console.error(`Could not find mod channel, or it is not a text channel. (${modChannel})`);
        }
        if (message.guildID !== channel.guild.id) {
            return;
        }

        const embeds = [{
            title: 'Bulk Message Delete',
            description: `${messages.length} messages were deleted in <#${messages[0].channel.id}>.`,
            color: 0xff0000,
            timestamp: new Date(),
        }];

        let textLog = `${messages.length} messages were deleted in ${messages[0].channel.name ?? 'Unknown Channel'} (${messages[0].channel.id}):\n`;
        for (const message of messages.reverse()) {
            const userString = message.author ?
                message.author.username ? `${message.author.username} (${message.author.id})` : `an unknown user (${message.author.id})`
                : 'an unknown user';
            const timestamp = message.timestamp || Base.getDiscordEpoch(message.id);
            const dateString = new Date(timestamp).toUTCString();
            const idString = `ID: ${message.id}\n`
            const contentString = message.content ? `Content:\n${message.content}\n` : 'No content\n';
            const attachmentString = message.attachments?.size ? `Attachments:\n${message.attachments.map(a => `  - [${a.filename}](${a.url})`).join('\n')}\n` : '';
            const embedString = message.embeds?.length ? `${message.embeds.length} embed(s)\n` : '';
            const pinString = message.pinned ? 'Pinned\n' : '';

            textLog += `- ${userString} - ${dateString} - ${idString}${contentString}${attachmentString}${embedString}${pinString}\n`;
        }

        await channel.createMessage({
            embeds,
            attachments: [{
                filename: 'log.txt',
                file: textLog,
            }]
        });
    } catch (e) {
        console.error(e);
    }
})

client.on('error', (error) => {
    console.error('Uncaught Error:', error);
});


client.connect();
