import { Client, Message, User, Collection, MessageEmbed, GuildMember } from "discord.js";
import { config, commandList as commands } from "../core/client";
import { ICommand } from "./interfaces";

const Cooldowns = new Collection<string, Collection<string, number>>();

/**
 * Checks the message is a command or not.
 * @param client - Client
 * @param message - Message
 */
export async function checkTheCommand(client: Client, message: Message) {
    const prefix = config.prefix;
    if (message.content.toLocaleLowerCase().indexOf(prefix) !== 0) return;
    const args = message.content.slice(prefix.length).trim().split(/ +/g);
    const command = (args.shift() as string).toLowerCase();

    try {
        const cmd: ICommand | undefined = commands.get(command) || commands.array().find(cmd => cmd.config.aliases && cmd.config.aliases.includes(command));
        if (!cmd) return;

        if (!cmd.config.enabled) return;
        if (cmd.require.developer && !isDeveloper(message.author)) return;

        if (isArray(cmd.require.permissions) && !isDeveloper(message.author)) {
            var perms: Array<string> = [];
            cmd.require.permissions.forEach(permission => {
                if ((message.member as GuildMember).permissions.has(permission)) return;
                else return perms.push(`\`${permission}\``);
            });

            if (isArray(perms)) return message.channel.send(new MessageEmbed({
                color: 'ORANGE',
                title: 'Missing Permissions',
                description: `${message.author} To run the command, you must have these permissions:\n\n${perms.join('\n')}`,
            }));
        }

        if (typeof cmd.config.cooldown == 'number') {
            if (!Cooldowns.has(cmd.config.name)) Cooldowns.set(cmd.config.name, new Collection<string, number>());
            const now = Date.now();
            const timestamps = Cooldowns.get(cmd.config.name);
            const cooldownAmount = cmd.config.cooldown * 1000;

            if (timestamps?.has(message.author.id)) {
                const currentTime = timestamps.get(message.author.id);
                if (typeof currentTime != 'undefined') {
                    const expirationTime = currentTime + cooldownAmount;
                    if (now < expirationTime) {
                        message.delete();
                        const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
                        return message.channel.send(new MessageEmbed({
                            color: 'ORANGE',
                            title: 'Calm Down',
                            description: `${message.author} To run the command, you must wait **${timeLeft}** more seconds.`
                        }));
                    }
                }
            }

            if (!isDeveloper(message.author)) {
                timestamps?.set(message.author.id, now);
                setTimeout(() => timestamps?.delete(message.author.id), cooldownAmount);
            }
        }

        await cmd.onTriggered(client, message, args);
    } catch (error: any) { return console.error(error); }
}

/**
 * Checks the user developer or not.
 * @param user - User
 */
export function isDeveloper(user: User): boolean {
    return config.developers.includes(user.id);
}

/**
 * Checks the value is array or not.
 * @param value - Any value
 */
export function isArray(value: any): boolean {
    return Array.isArray(value) && value.length > 0;
}