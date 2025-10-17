const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// Bot configuration
const BOT_TOKEN = '8496920298:AAEExKqjgCU4WkkzeD7XuEfVLqItJ6NrR3w';
const ORGANIZER_ID = 5698050836;

// Create bot instance
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Configuration file for game settings
const CONFIG_FILE = 'bot-config.json';

// Game sessions storage
let gameSessions = {};

// Default configuration
const defaultConfig = {
    isActive: false,
    currentGame: null
};

// Load configuration
let config = defaultConfig;
try {
    if (fs.existsSync(CONFIG_FILE)) {
        config = { ...defaultConfig, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
    }
} catch (error) {
    console.log('Using default configuration');
}

// Save configuration
function saveConfig() {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Casino combinations with display names
const CASINO_COMBINATIONS = {
    '777': {
        name: '7️⃣ 777',
        patterns: ['777', '7️⃣7️⃣7️⃣', '7 7 7', '7️⃣ 7️⃣ 7️⃣']
    },
    'BAR': {
        name: '🟫 BAR BAR BAR',
        patterns: ['BAR BAR BAR', 'БАР БАР БАР', '🟫🟫🟫', '🟫 🟫 🟫']
    },
    'VINOGRAD': {
        name: '🍇 ВИНОГРАД',
        patterns: ['🍇🍇🍇', 'ВИНОГРАД ВИНОГРАД ВИНОГРАД', 'виноград виноград виноград', '🍇 🍇 🍇']
    },
    'LIMON': {
        name: '🍋 ЛИМОН',
        patterns: ['🍋🍋🍋', 'ЛИМОН ЛИМОН ЛИМОН', 'лимон лимон лимон', 'LIMON LIMON LIMON', '🍋 🍋 🍋']
    }
};

// Check if message contains winning combination
function checkWinningCombination(messageText, gameConfig) {
    if (!messageText || !gameConfig) return null;
    
    const { winningCombination, isSequential, requiredCount } = gameConfig;
    const combination = CASINO_COMBINATIONS[winningCombination];
    
    if (!combination) return null;
    
    let foundCount = 0;
    let lastIndex = -1;
    
    // Count occurrences and check sequence if needed
    for (const pattern of combination.patterns) {
        let searchIndex = 0;
        
        while (true) {
            const index = messageText.indexOf(pattern, searchIndex);
            if (index === -1) break;
            
            if (isSequential) {
                if (index > lastIndex) {
                    foundCount++;
                    lastIndex = index + pattern.length;
                } else {
                    // Reset if not in sequence
                    foundCount = 1;
                    lastIndex = index + pattern.length;
                }
            } else {
                foundCount++;
            }
            
            searchIndex = index + 1;
            
            if (foundCount >= requiredCount) {
                return {
                    combination: winningCombination,
                    count: foundCount,
                    pattern: pattern
                };
            }
        }
    }
    
    return null;
}

// Handle messages
bot.on('message', async (msg) => {
    try {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const messageText = msg.text || msg.caption || '';
        
        // Only process if bot is active and game is running
        if (!config.isActive || !config.currentGame) return;
        
        // Check if this is a winning combination
        const winResult = checkWinningCombination(messageText, config.currentGame);
        if (winResult) {
            console.log(`🎉 Winning combination found in chat ${chatId} by user ${userId}`);
            console.log(`Message: ${messageText}`);
            console.log(`Result:`, winResult);
            
            // Send congratulations message
            const winnerName = msg.from.first_name || msg.from.username || 'Победитель';
            const gameConfig = config.currentGame;
            const combinationName = CASINO_COMBINATIONS[gameConfig.winningCombination].name;
            
            const congratsMessage = `🎉🎉🎉 ПОЗДРАВЛЯЕМ! 🎉🎉🎉\n\n` +
                `🏆 ${winnerName} выиграл!\n\n` +
                `🎯 Выигрышная комбинация: ${combinationName}\n` +
                `📊 Найдено: ${winResult.count} из ${gameConfig.requiredCount}\n` +
                `🔄 Тип: ${gameConfig.isSequential ? 'Подряд' : 'Не подряд'}\n\n` +
                `🎊 Розыгрыш завершен! 🎊`;
            
            await bot.sendMessage(chatId, congratsMessage);
            
            // Stop the game
            config.isActive = false;
            config.currentGame = null;
            saveConfig();
            
            // Wait a moment then close the chat
            setTimeout(async () => {
                try {
                    await bot.leaveChat(chatId);
                    console.log(`✅ Left chat ${chatId} after finding winner`);
                    
                    // Notify organizer
                    await bot.sendMessage(ORGANIZER_ID, 
                        `🎉 Розыгрыш завершен!\n\n` +
                        `👤 Победитель: ${winnerName} (ID: ${userId})\n` +
                        `🎯 Комбинация: ${combinationName}\n` +
                        `📊 Найдено: ${winResult.count}/${gameConfig.requiredCount}\n` +
                        `🔄 Тип: ${gameConfig.isSequential ? 'Подряд' : 'Не подряд'}\n` +
                        `💬 Чат: ${chatId}\n\n` +
                        `✅ Бот покинул чат.`
                    );
                } catch (error) {
                    console.error('Error leaving chat:', error.message);
                    await bot.sendMessage(ORGANIZER_ID, 
                        `🎉 Найден победитель!\n\n` +
                        `👤 Победитель: ${winnerName} (ID: ${userId})\n` +
                        `🎯 Комбинация: ${combinationName}\n` +
                        `💬 Чат: ${chatId}\n\n` +
                        `⚠️ Не удалось покинуть чат автоматически.`
                    );
                }
            }, 3000);
        }
        
    } catch (error) {
        console.error('Error processing message:', error);
    }
});

// Interactive menu functions
function getMainMenu() {
    const gameStatus = config.currentGame ? 
        `🎮 Игра запущена: ${CASINO_COMBINATIONS[config.currentGame.winningCombination].name}` :
        `🚫 Игра не запущена`;
    
    return {
        text: `🎰 Casino Bot Меню\n\n${gameStatus}\n\nВыберите действие:`,
        reply_markup: {
            inline_keyboard: [
                [{ text: '🎮 Начать игру', callback_data: 'start_game' }],
                [{ text: '📊 Статус', callback_data: 'status' }],
                config.currentGame ? 
                    [{ text: '⏹️ Остановить игру', callback_data: 'stop_game' }] :
                    []
            ].filter(row => row.length > 0)
        }
    };
}

function getCombinationMenu() {
    return {
        text: `🎯 Выберите выигрышную комбинацию:`,
        reply_markup: {
            inline_keyboard: [
                [{ text: CASINO_COMBINATIONS['777'].name, callback_data: 'combo_777' }],
                [{ text: CASINO_COMBINATIONS['BAR'].name, callback_data: 'combo_BAR' }],
                [{ text: CASINO_COMBINATIONS['VINOGRAD'].name, callback_data: 'combo_VINOGRAD' }],
                [{ text: CASINO_COMBINATIONS['LIMON'].name, callback_data: 'combo_LIMON' }],
                [{ text: '⬅️ Назад', callback_data: 'back_to_main' }]
            ]
        }
    };
}

function getSequenceMenu(combination) {
    return {
        text: `🔄 Тип поиска для ${CASINO_COMBINATIONS[combination].name}:`,
        reply_markup: {
            inline_keyboard: [
                [{ text: '🔁 Подряд (последовательно)', callback_data: `seq_${combination}_true` }],
                [{ text: '🔀 Не подряд (любое место)', callback_data: `seq_${combination}_false` }],
                [{ text: '⬅️ Назад', callback_data: 'back_to_combinations' }]
            ]
        }
    };
}

function getCountMenu(combination, isSequential) {
    return {
        text: `📊 Укажите количество комбинаций\n\nКомбинация: ${CASINO_COMBINATIONS[combination].name}\nТип: ${isSequential ? '🔁 Подряд' : '🔀 Не подряд'}\n\nВведите число от 1 до 10:`,
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '1', callback_data: `count_${combination}_${isSequential}_1` },
                    { text: '2', callback_data: `count_${combination}_${isSequential}_2` },
                    { text: '3', callback_data: `count_${combination}_${isSequential}_3` }
                ],
                [
                    { text: '4', callback_data: `count_${combination}_${isSequential}_4` },
                    { text: '5', callback_data: `count_${combination}_${isSequential}_5` },
                    { text: '6', callback_data: `count_${combination}_${isSequential}_6` }
                ],
                [
                    { text: '7', callback_data: `count_${combination}_${isSequential}_7` },
                    { text: '8', callback_data: `count_${combination}_${isSequential}_8` },
                    { text: '9', callback_data: `count_${combination}_${isSequential}_9` }
                ],
                [
                    { text: '10', callback_data: `count_${combination}_${isSequential}_10` }
                ],
                [{ text: '⬅️ Назад', callback_data: `back_to_sequence_${combination}` }]
            ]
        }
    };
}

// Commands
bot.onText(/\/start/, async (msg) => {
    if (msg.from.id === ORGANIZER_ID) {
        const menu = getMainMenu();
        await bot.sendMessage(msg.chat.id, menu.text, menu);
    }
});

bot.onText(/\/start_game/, async (msg) => {
    if (msg.from.id === ORGANIZER_ID) {
        const menu = getCombinationMenu();
        await bot.sendMessage(msg.chat.id, menu.text, menu);
    }
});

bot.onText(/\/status/, async (msg) => {
    if (msg.from.id === ORGANIZER_ID) {
        let statusText = `🎰 Статус Casino Bot:\n\n`;
        
        if (config.currentGame) {
            statusText += `🔄 Статус: ✅ Игра запущена\n`;
            statusText += `🎯 Комбинация: ${CASINO_COMBINATIONS[config.currentGame.winningCombination].name}\n`;
            statusText += `🔁 Тип: ${config.currentGame.isSequential ? 'Подряд' : 'Не подряд'}\n`;
            statusText += `📊 Количество: ${config.currentGame.requiredCount}\n`;
        } else {
            statusText += `🔄 Статус: ❌ Игра не запущена\n`;
        }
        
        await bot.sendMessage(msg.chat.id, statusText);
    }
});

// Callback query handlers
bot.on('callback_query', async (query) => {
    try {
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;
        const userId = query.from.id;
        const data = query.data;
        
        // Only organizer can use callbacks
        if (userId !== ORGANIZER_ID) {
            await bot.answerCallbackQuery(query.id, { text: '⚠️ Нет доступа' });
            return;
        }
        
        if (data === 'start_game') {
            const menu = getCombinationMenu();
            await bot.editMessageText(menu.text, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: menu.reply_markup
            });
        }
        
        else if (data === 'status') {
            let statusText = `🎰 Статус Casino Bot:\n\n`;
            
            if (config.currentGame) {
                statusText += `🔄 Статус: ✅ Игра запущена\n`;
                statusText += `🎯 Комбинация: ${CASINO_COMBINATIONS[config.currentGame.winningCombination].name}\n`;
                statusText += `🔁 Тип: ${config.currentGame.isSequential ? 'Подряд' : 'Не подряд'}\n`;
                statusText += `📊 Количество: ${config.currentGame.requiredCount}\n\n`;
                statusText += `🔄 Бот отслеживает сообщения...`;
            } else {
                statusText += `🔄 Статус: ❌ Игра не запущена\n\n`;
                statusText += `ℹ️ Используйте /start_game для начала`;
            }
            
            await bot.answerCallbackQuery(query.id, { text: statusText, show_alert: true });
        }
        
        else if (data === 'stop_game') {
            config.isActive = false;
            config.currentGame = null;
            saveConfig();
            
            const menu = getMainMenu();
            await bot.editMessageText(menu.text, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: menu.reply_markup
            });
            
            await bot.answerCallbackQuery(query.id, { text: '✅ Игра остановлена' });
        }
        
        else if (data === 'back_to_main') {
            const menu = getMainMenu();
            await bot.editMessageText(menu.text, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: menu.reply_markup
            });
        }
        
        else if (data === 'back_to_combinations') {
            const menu = getCombinationMenu();
            await bot.editMessageText(menu.text, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: menu.reply_markup
            });
        }
        
        else if (data.startsWith('combo_')) {
            const combination = data.replace('combo_', '');
            const menu = getSequenceMenu(combination);
            await bot.editMessageText(menu.text, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: menu.reply_markup
            });
        }
        
        else if (data.startsWith('seq_')) {
            const parts = data.split('_');
            const combination = parts[1];
            const isSequential = parts[2] === 'true';
            
            const menu = getCountMenu(combination, isSequential);
            await bot.editMessageText(menu.text, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: menu.reply_markup
            });
        }
        
        else if (data.startsWith('back_to_sequence_')) {
            const combination = data.replace('back_to_sequence_', '');
            const menu = getSequenceMenu(combination);
            await bot.editMessageText(menu.text, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: menu.reply_markup
            });
        }
        
        else if (data.startsWith('count_')) {
            const parts = data.split('_');
            const combination = parts[1];
            const isSequential = parts[2] === 'true';
            const requiredCount = parseInt(parts[3]);
            
            // Start the game
            config.currentGame = {
                winningCombination: combination,
                isSequential: isSequential,
                requiredCount: requiredCount
            };
            config.isActive = true;
            saveConfig();
            
            const successText = `✅ Игра запущена!\n\n` +
                `🎯 Комбинация: ${CASINO_COMBINATIONS[combination].name}\n` +
                `🔁 Тип: ${isSequential ? 'Подряд' : 'Не подряд'}\n` +
                `📊 Количество: ${requiredCount}\n\n` +
                `🔄 Бот начал отслеживать сообщения...`;
            
            await bot.editMessageText(successText, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🏠 Главное меню', callback_data: 'back_to_main' }],
                        [{ text: '⏹️ Остановить игру', callback_data: 'stop_game' }]
                    ]
                }
            });
            
            await bot.answerCallbackQuery(query.id, { text: '✅ Игра запущена!' });
            
            console.log(`🎰 Game started by organizer:`);
            console.log(`▶️ Combination: ${combination}`);
            console.log(`🔁 Sequential: ${isSequential}`);
            console.log(`📊 Required count: ${requiredCount}`);
        }
        
    } catch (error) {
        console.error('Callback query error:', error);
        await bot.answerCallbackQuery(query.id, { text: '⚠️ Ошибка' });
    }
});

// Error handling
bot.on('error', (error) => {
    console.error('Bot error:', error);
});

bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

console.log('🎰 Casino Bot запущен!');
if (config.currentGame) {
    console.log(`🎮 Игра запущена: ${CASINO_COMBINATIONS[config.currentGame.winningCombination].name}`);
    console.log(`🔁 Тип: ${config.currentGame.isSequential ? 'Подряд' : 'Не подряд'}`);
    console.log(`📊 Количество: ${config.currentGame.requiredCount}`);
} else {
    console.log('🚫 Игра не запущена. Используйте /start_game для настройки.');
}
