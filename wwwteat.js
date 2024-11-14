const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const winston = require('winston');

// Токен вашего бота, полученный через BotFather
const token = '8075874421:AAHwWSia-Hs3bHeTFrTVPJnOVVofYBYPD1o'; // Замените на ваш токен
const bot = new TelegramBot(token, { polling: true });
const MASTER_CHAT_ID = '7808242760';

// Настройка winston для логирования
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} ${level}: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/combined.log' })
    ],
});

logger.info('Bot started');

// Инициализация базы данных SQLite для хранения записей на экскурсию
const dbBook = new sqlite3.Database('./DB/tour_bookings.db', (err) => {
    if (err) {
        logger.error('Ошибка при подключении к базе данных:', err.message);
    } else {
        logger.info('Подключение к базе данных успешно');
    }
});

// Создание таблицы для хранения записей на экскурсию, если она еще не существует
dbBook.run(`
    CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT,
        date TEXT,
        time TEXT
    )
`);

// Структура данных для отслеживания состояния
let userData = {};
let userStates = {};

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    userData[chatId] = {}; // Инициализация данных для пользователя

    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "🏠Расчет стоимости ремонта", callback_data: 'calculate_cost' }],
                [{ text: '📸 Портфолио наших объектов', url: 'https://proremont18.ru/nashi-rabotyi/' }],
                [{ text: "📝Отзывы", url: 'https://vk.com/app6326142_-214261496' }],
                [{ text: "📝Записаться на экскурсию", callback_data: 'book_tour' }],
                [{ text: "❓Топ часто задаваемых вопросов", callback_data: 'faq' }],
                [{ text: "🎁 ПОДАРОК", callback_data: 'gift' }],
                [{ text: 'Контактная информация 📞', callback_data: 'contact_info' }],
                [{ text: '👨‍💼 Связаться с менеджером', callback_data: 'contact_manager' }]
            ]
        }
    };

    bot.sendMessage(chatId, '🛠Добро пожаловать в ПроРемонт! Наш бот может записать вас на экскурсию по нашим действующим объектам, а также вы можете посмотреть портфолио наших объектов и отзывы заказчиков!🛠', options);
});

// FAQ сообщение
const faqMessage = `Ответы на часто задаваемые вопросы: 
 
Сколько стоит ремонт за квадратный метр? 
Стоимость ремонта под ключ за квадрат начинается от 10.000₽/кв.м в зависимости от дизайн-проекта. Для более подробного расчета отправьте нам дизайн-проект, в течение 3х рабочих дней мы отправим Вам предварительную смету. 
 
Какие сроки выполнения работ? 
Очередь на начало ремонтных работ у нас в среднем 1-1.5 месяца, срок работ из расчёта 10кв.м/месяц. Помните, сроки зависят не только от бригады, но и от подрядчиков мебели, сантехники, электрики, а также быстроты принимаемых заказчиком решений. 
 
Как можно следить за ходом ремонта? 
На каждый объект создается индивидуальный чат, со всей командой и участниками процесса. Контролировать ход работ можно как вживую, так и удаленно. Мы регулярно отправляем фотоотчеты, а по просьбе заказчика можем подключить к системе видеонаблюдения. 
 
Как контролировать расходы по ремонту? 
На ваш телефон будет установлено специальное приложение, в котором вы в онлайн режиме сможете видеть все расходы по ремонту. Чеки на материалы, объемы выполненных работ и пр. расходы.`;

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data === 'faq') {
        bot.sendMessage(chatId, faqMessage, { parse_mode: 'Markdown' });
    } else if (data === 'book_tour') {
        userData[chatId] = {}; // Инициализация данных для пользователя
        bot.sendMessage(chatId, 'Введите ваше имя:');
    } else if (data === 'contact_info') {
        const contactInfo = `
Контактная информация:
📍 Адрес: г. Ижевск, ул. Металлургов, 2
📞 Телефон: +7 (919) 916-20-49
✉️ E-mail: proremont.18@yandex.ru
🕒 Режим работы: Пн. – Пт. с 8:00 до 17:00`;
        bot.sendMessage(chatId, contactInfo);
    } else if (data === 'contact_manager') {
        const contactInfo = `
👨‍💼 *Связаться с нашим менеджером:*
📞 Телефон: +7 (919) 916-20-49
📧 E-mail: proremont.18@yandex.ru`;
        bot.sendMessage(chatId, contactInfo);
    } else if (data === 'gift') {
        sendGiftFiles(chatId);
    } else if (data === 'calculate_cost') {
        userStates[chatId] = 'choose_property_type';
        bot.sendMessage(chatId, 'Выберите тип недвижимости:', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Новостройка", callback_data: "new_building" }],
                    [{ text: "Вторичное жилье", callback_data: "secondary_housing" }],
                    [{ text: "Коммерческая недвижимость", callback_data: "commercial" }],
                    [{ text: "Частный дом", callback_data: "private_house" }]
                ]
            }
        });
    } else if (userStates[chatId] === 'choose_property_type') {
        userStates[chatId] = 'has_design_project';
        userData[chatId] = { propertyType: data }; // Сохраняем тип недвижимости
        bot.sendMessage(chatId, 'У вас есть дизайн проект?', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Нет", callback_data: "has_design_yes" }],
                    [{ text: "Да", callback_data: "has_design_no" }]
                ]
            }
        });
    } else if (userStates[chatId] === 'has_design_project') {
        if (data === 'has_design_yes') {
            userStates[chatId] = 'enter_area';
            bot.sendMessage(chatId, 'Введите площадь в квадратных метрах:');
        } else if (data === 'has_design_no') {
            bot.sendMessage(chatId, 'Точную стоимость работ возможно рассчитать только по дизайн проекту. Если у вас его нет, мы готовы его для вас сделать. Нажмите кнопку, чтобы связаться с менеджером.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "Связаться с менеджером", url: "https://t.me/+79199162049" }]
                    ]
                }
            });
            delete userStates[chatId]; // Завершаем процесс, так как дизайн проект не предоставлен
        } else if (userStates[chatId] === 'enter_area') {
        const area = parseFloat(text);
        if (isNaN(area)) {
            bot.sendMessage(chatId, 'Пожалуйста, введите корректное число для площади.');
            return;
        }

        userData[chatId].area = area; // Сохраняем площадь
        userStates[chatId] = 'enter_rooms';
        bot.sendMessage(chatId, 'Введите количество комнат:');
    } else if (userStates[chatId] === 'enter_rooms') {
        const rooms = parseInt(text);
        if (isNaN(rooms)) {
            bot.sendMessage(chatId, 'Пожалуйста, введите корректное число для количества комнат.');
            return;
        }

        userData[chatId].rooms = rooms; // Сохраняем количество комнат
        userStates[chatId] = 'enter_bathrooms';
        bot.sendMessage(chatId, 'Введите количество санузлов:');
    } else if (userStates[chatId] === 'enter_bathrooms') {
        const bathrooms = parseInt(text);
        if (isNaN(bathrooms)) {
            bot.sendMessage(chatId, 'Пожалуйста, введите корректное число для количества санузлов.');
            return;
        }

        userData[chatId].bathrooms = bathrooms; // Сохраняем количество санузлов
        const area = userData[chatId].area;
        const costPerMeter = area < 50 ? 20000 : 15000; // Условия стоимости в зависимости от площади
        const totalCost = costPerMeter * area;

        bot.sendMessage(chatId, `Стоимость ремонтных работ от ${costPerMeter}₽ за квадратный метр\nОбщая стоимость: ${totalCost}₽`);
        bot.sendMessage(chatId, 'Для более подробного расчета именно вашего проекта вы можете записаться на бесплатный замер или отправить ваш дизайн проект менеджеру.');

        // Уведомление мастера
        const messageToMaster = `
            Новый запрос на расчет стоимости ремонта:
            Тип недвижимости: ${userData[chatId].propertyType}
            Площадь: ${area} м²
            Количество комнат: ${userData[chatId].rooms}
            Количество санузлов: ${userData[chatId].bathrooms}
            Стоимость ремонта: от ${costPerMeter}₽ за м²
            Общая стоимость: ${totalCost}₽
            Контакт с клиентом: ${chatId}.
        `;
        bot.sendMessage(MASTER_CHAT_ID, messageToMaster).catch(error => {
            console.error('Ошибка отправки сообщения мастеру:', error);
        });
    }
    bot.answerCallbackQuery(query.id, { text: 'Вы выбрали действие!' });
}});

async function sendGiftFiles(chatId) {
    const loadingMsg = await bot.sendMessage(chatId, 'Загрузка файлов...');
    const pdfFiles = [
        'pdf/Aq.pdf',
        'pdf/compressed.pdf'
    ];

    for (const file of pdfFiles) {
        try {
            await bot.sendDocument(chatId, file);
            logger.info(`Файл ${file} отправлен успешно.`);
        } catch (error) {
            logger.error(`Ошибка при отправке файла ${file}: ${error.message}`);
            await bot.sendMessage(chatId, 'Ошибка при отправке файла.');
        }
    }

    await bot.deleteMessage(chatId, loadingMsg.message_id);
    bot.sendMessage(chatId, 'Файлы успешно отправлены!');
    logger.info('Все файлы отправлены.');
}

// Обработка ввода для записи на экскурсию
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Инициализируем userData, если его нет
    if (!userData[chatId]) {
        userData[chatId] = {};
    }

    // Проверяем состояние пользователя
    if (!userData[chatId].name) {
        // Сохраняем имя
        userData[chatId].name = text;
        bot.sendMessage(chatId, 'Введите ваш номер телефона:');
        userData[chatId].step = 'awaiting_phone'; // Устанавливаем шаг
    } else if (userData[chatId].step === 'awaiting_phone') {
        // Валидация номера телефона
        if (isValidPhoneNumber(text)) {
            // Сохраняем телефон
            userData[chatId].phone = text;
            bot.sendMessage(chatId, 'Введите дату и время бронирования (например, 2024-11-14 15:30):');
            userData[chatId].step = 'awaiting_booking_datetime'; // Устанавливаем шаг
        } else {
            bot.sendMessage(chatId, 'Пожалуйста, введите корректный номер телефона:');
        }
    } else if (userData[chatId].step === 'awaiting_booking_datetime') {
        // Валидация даты и времени
        if (isValidDateTime(text)) {
            // Сохраняем дату и время бронирования
            userData[chatId].bookingDateTime = text;

            // Подтверждение для пользователя
            bot.sendMessage(chatId, 'Ваш тур успешно забронирован!');

            // Отправка уведомления мастеру
            const masterMessage = `
📅 *Новое бронирование:*
Пользователь: ${userData[chatId].name}
Телефон: ${userData[chatId].phone}
ID: ${chatId}
Дата и время бронирования: ${userData[chatId].bookingDateTime}`;
            bot.sendMessage(MASTER_CHAT_ID, masterMessage);

            // Очищаем данные пользователя после бронирования
            delete userData[chatId];
        } else {
            bot.sendMessage(chatId, 'Пожалуйста, введите корректную дату и время бронирования (например, 2024-11-14 15:30):');
        }
    }
});

// Функция для валидации номера телефона
function isValidPhoneNumber(phone) {
    // Пример простой валидации номера телефона (можно изменить по необходимости)
    const phoneRegex = /^\+?[0-9]{10,15}$/; // Регулярное выражение для проверки
    return phoneRegex.test(phone);
}

// Функция для валидации даты и времени
function isValidDateTime(dateTime) {
    // Пример простой валидации даты и времени (можно изменить по необходимости)
    const dateTimeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/; // Формат: YYYY-MM-DD HH:MM
    return dateTimeRegex.test(dateTime);
}