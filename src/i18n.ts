export type LanguageCode = "ru" | "en" | "tr" | "es" | "pt" | "ar" | "id" | "hi" | "vi" | "zh" | "de" | "fr";

export type TranslationKey =
  | "game.title"
  | "menu.mode"
  | "mode.multiplayer"
  | "mode.duel"
  | "mode.deathmatch"
  | "mode.survival"
  | "mode.unavailable"
  | "mode.duelDescription"
  | "mode.deathmatchDescription"
  | "mode.survivalDescription"
  | "menu.settings"
  | "settings.enemies"
  | "settings.spinnerSize"
  | "settings.botLevel"
  | "bot.easy"
  | "bot.normal"
  | "bot.hard"
  | "menu.start"
  | "menu.play"
  | "menu.workshop"
  | "menu.dailyTasks"
  | "menu.freeChest"
  | "menu.taskPlay"
  | "menu.taskWin"
  | "menu.taskDamage"
  | "menu.shop"
  | "menu.achievements"
  | "menu.news"
  | "menu.sound"
  | "menu.soundOff"
  | "menu.addCurrency"
  | "menu.controls"
  | "menu.sections"
  | "menu.selected"
  | "menu.openChest"
  | "dev.settings"
  | "workshop.title"
  | "workshop.style"
  | "workshop.tuning"
  | "workshop.appearance"
  | "workshop.upgrades"
  | "workshop.previewTitle"
  | "workshop.previewHint"
  | "workshop.rotate"
  | "workshop.elements"
  | "workshop.models"
  | "workshop.colors"
  | "workshop.trails"
  | "workshop.auras"
  | "workshop.offers"
  | "workshop.owned"
  | "workshop.equipped"
  | "workshop.buy"
  | "workshop.equip"
  | "workshop.previewing"
  | "workshop.available"
  | "workshop.premium"
  | "workshop.yan"
  | "workshop.unavailable"
  | "workshop.insufficient"
  | "workshop.modelLoadFailed"
  | "upgrade.maxRpm"
  | "upgrade.damage"
  | "upgrade.dash"
  | "upgrade.ultimate"
  | "common.back"
  | "common.previous"
  | "common.next"
  | "parts.name"
  | "unit.secondsShort"
  | "result.victory"
  | "result.defeat"
  | "result.place"
  | "result.kills"
  | "result.earned"
  | "result.balance"
  | "result.replay"
  | "result.double"
  | "result.menu"
  | "catalog.model.default"
  | "catalog.model.street"
  | "catalog.model.turbo"
  | "catalog.model.legend"
  | "catalog.model.neon"
  | "catalog.model.champion"
  | "catalog.color.default"
  | "catalog.color.red"
  | "catalog.color.blue"
  | "catalog.color.green"
  | "catalog.color.violet"
  | "catalog.color.gold"
  | "catalog.color.white"
  | "catalog.color.black"
  | "catalog.color.gray"
  | "catalog.color.navy"
  | "catalog.color.darkGreen"
  | "catalog.color.burgundy"
  | "catalog.color.orange"
  | "catalog.color.yellow"
  | "catalog.color.pink"
  | "catalog.color.mint"
  | "catalog.color.lime"
  | "catalog.color.cyan"
  | "catalog.color.lavender"
  | "catalog.color.raspberry"
  | "catalog.trail.default"
  | "catalog.trail.fire"
  | "catalog.trail.ice"
  | "catalog.trail.toxic"
  | "catalog.trail.neon"
  | "catalog.trail.gold"
  | "catalog.aura.none"
  | "catalog.aura.crit"
  | "catalog.aura.green"
  | "catalog.aura.pink"
  | "catalog.aura.red"
  | "catalog.aura.yellow"
  | "offer.noAds"
  | "offer.parts500"
  | "offer.parts3000"
  | "common.level"
  | "menu.selectElement"
  | "element.fire"
  | "element.ice"
  | "element.earth"
  | "element.lightning"
  | "hud.dash"
  | "hud.ultimate"
  | "hud.ready"
  | "hud.active"
  | "hud.respawn"
  | "hud.invulnerable"
  | "hud.continue"
  | "hud.continueIn"
  | "hud.leaderboard"
  | "hud.place"
  | "hud.name"
  | "hud.killsShort"
  | "hud.deathsShort"
  | "hud.critShort"
  | "hud.rating"
  | "orientation.rotate";

type TranslationTable = Partial<Record<TranslationKey, string>>;

const translations: Record<LanguageCode, TranslationTable> = {
  ru: {
    "game.title": "Turbo Spin Arena",
    "menu.mode": "Режим",
    "mode.multiplayer": "Мультиплеер",
    "mode.duel": "1 на 1",
    "mode.deathmatch": "На выбывание",
    "mode.survival": "Выживание",
    "mode.unavailable": "Скоро",
    "mode.duelDescription": "Выбей соперника за пределы арены",
    "mode.deathmatchDescription": "Набери лучший рейтинг за три минуты",
    "mode.survivalDescription": "Продержись против волн врагов",
    "menu.settings": "Настройки",
    "settings.enemies": "Боты",
    "settings.spinnerSize": "Размер",
    "settings.botLevel": "Уровень ботов",
    "bot.easy": "Легко",
    "bot.normal": "Нормально",
    "bot.hard": "Сложно",
    "menu.start": "Старт",
    "menu.play": "Играть",
    "menu.workshop": "Мастерская",
    "menu.dailyTasks": "Ежедневные задания",
    "menu.freeChest": "Бесплатный ящик",
    "menu.taskPlay": "Сыграй 3 боя",
    "menu.taskWin": "Выиграй 2 боя",
    "menu.taskDamage": "Нанеси 5000 урона",
    "menu.shop": "Магазин",
    "menu.achievements": "Достижения",
    "menu.news": "Новости",
    "menu.sound": "Звук включён",
    "menu.soundOff": "Звук выключен",
    "menu.addCurrency": "Добавить валюту",
    "menu.controls": "Управление меню",
    "menu.sections": "Разделы меню",
    "menu.selected": "Выбрано",
    "menu.openChest": "Открыть ящик",
    "dev.settings": "Настройки разработки",
    "workshop.title": "Мастерская",
    "workshop.style": "Стиль",
    "workshop.tuning": "Боевой тюнинг",
    "workshop.appearance": "Внешний вид",
    "workshop.upgrades": "Усиления",
    "workshop.previewTitle": "Твой бейблейд",
    "workshop.previewHint": "Потяни, чтобы повернуть. Предпросмотр не меняет установленный предмет.",
    "workshop.rotate": "Повернуть бейблейд",
    "workshop.elements": "Элементы",
    "workshop.models": "Модель",
    "workshop.colors": "Цвета",
    "workshop.trails": "След",
    "workshop.auras": "Аура",
    "workshop.offers": "Премиум",
    "workshop.owned": "Куплено",
    "workshop.equipped": "Установлено",
    "workshop.buy": "Купить",
    "workshop.equip": "Установить",
    "workshop.previewing": "Просматривается",
    "workshop.available": "Доступно",
    "workshop.premium": "Премиум",
    "workshop.yan": "Ян",
    "workshop.unavailable": "Платежи пока недоступны",
    "workshop.insufficient": "Недостаточно деталей",
    "workshop.modelLoadFailed": "Не удалось загрузить модель. Используется стандартная.",
    "upgrade.maxRpm": "Максимальный RPM",
    "upgrade.damage": "Урон",
    "upgrade.dash": "Перезарядка Dash",
    "upgrade.ultimate": "Заряд",
    "common.back": "Назад",
    "common.previous": "Предыдущий",
    "common.next": "Следующий",
    "parts.name": "Детали",
    "unit.secondsShort": "сек",
    "result.victory": "Победа",
    "result.defeat": "Поражение",
    "result.place": "Место",
    "result.kills": "Убийства",
    "result.earned": "Получено деталей",
    "result.balance": "Баланс",
    "result.replay": "Играть снова",
    "result.double": "Получить x2 деталей",
    "result.menu": "Главное меню",
    "catalog.model.default": "Сток",
    "catalog.model.street": "Уличный",
    "catalog.model.turbo": "Турбо",
    "catalog.model.legend": "Легенда",
    "catalog.model.neon": "Неон",
    "catalog.model.champion": "Чемпион",
    "catalog.color.default": "Заводской синий",
    "catalog.color.red": "Гоночный красный",
    "catalog.color.blue": "Электрический синий",
    "catalog.color.green": "Токсичный зелёный",
    "catalog.color.violet": "Неоновый фиолетовый",
    "catalog.color.gold": "Золото мастерской",
    "catalog.color.white": "Белый",
    "catalog.color.black": "Чёрный",
    "catalog.color.gray": "Серый",
    "catalog.color.navy": "Тёмно-синий",
    "catalog.color.darkGreen": "Тёмно-зелёный",
    "catalog.color.burgundy": "Бордовый",
    "catalog.color.orange": "Оранжевый",
    "catalog.color.yellow": "Жёлтый",
    "catalog.color.pink": "Розовый",
    "catalog.color.mint": "Мятный",
    "catalog.color.lime": "Лаймовый",
    "catalog.color.cyan": "Голубой",
    "catalog.color.lavender": "Лавандовый",
    "catalog.color.raspberry": "Малиновый",
    "catalog.trail.default": "Белый",
    "catalog.trail.fire": "Огненный",
    "catalog.trail.ice": "Ледяной",
    "catalog.trail.toxic": "Токсичный",
    "catalog.trail.neon": "Неоновый",
    "catalog.trail.gold": "Золотой",
    "catalog.aura.none": "Без ауры",
    "catalog.aura.crit": "Критическая аура",
    "catalog.aura.green": "Зелёная аура",
    "catalog.aura.pink": "Розовая аура",
    "catalog.aura.red": "Красная аура",
    "catalog.aura.yellow": "Жёлтая аура",
    "offer.noAds": "Без рекламы",
    "offer.parts500": "500 деталей",
    "offer.parts3000": "3000 деталей",
    "common.level": "Ур.",
    "menu.selectElement": "Выбор элемента",
    "element.fire": "Огонь",
    "element.ice": "Лёд",
    "element.earth": "Земля",
    "element.lightning": "Молния",
    "hud.dash": "Рывок",
    "hud.ultimate": "Ульта",
    "hud.ready": "Готово",
    "hud.active": "Активно",
    "hud.respawn": "Возрождение",
    "hud.invulnerable": "Неуязвим",
    "hud.continue": "Продолжить",
    "hud.continueIn": "Продолжить через",
    "hud.leaderboard": "Рейтинг",
    "hud.place": "Место",
    "hud.name": "Имя",
    "hud.killsShort": "У",
    "hud.deathsShort": "С",
    "hud.critShort": "Крит",
    "hud.rating": "Рейтинг",
    "orientation.rotate": "Поверни устройство",
  },
  en: {
    "game.title": "Turbo Spin Arena",
    "menu.mode": "Mode",
    "mode.multiplayer": "Multiplayer",
    "mode.duel": "1v1",
    "mode.deathmatch": "Deathmatch",
    "mode.survival": "Survival",
    "mode.unavailable": "Soon",
    "mode.duelDescription": "Knock your opponent out of the arena",
    "mode.deathmatchDescription": "Score the highest rating in three minutes",
    "mode.survivalDescription": "Hold out against enemy waves",
    "menu.settings": "Settings",
    "settings.enemies": "Bots",
    "settings.spinnerSize": "Size",
    "settings.botLevel": "Bot level",
    "bot.easy": "Easy",
    "bot.normal": "Normal",
    "bot.hard": "Hard",
    "menu.start": "Start",
    "menu.play": "Play",
    "menu.workshop": "Workshop",
    "menu.dailyTasks": "Daily missions",
    "menu.freeChest": "Free chest",
    "menu.taskPlay": "Play 3 battles",
    "menu.taskWin": "Win 2 battles",
    "menu.taskDamage": "Deal 5000 damage",
    "menu.shop": "Shop",
    "menu.achievements": "Achievements",
    "menu.news": "News",
    "menu.sound": "Sound on",
    "menu.soundOff": "Sound off",
    "menu.addCurrency": "Add currency",
    "menu.controls": "Menu controls",
    "menu.sections": "Menu sections",
    "menu.selected": "Selected",
    "menu.openChest": "Open chest",
    "dev.settings": "Development settings",
    "workshop.title": "Workshop",
    "workshop.style": "Style",
    "workshop.tuning": "Combat tuning",
    "workshop.appearance": "Appearance",
    "workshop.upgrades": "Upgrades",
    "workshop.previewTitle": "Your spinner",
    "workshop.previewHint": "Drag to rotate. Preview does not change equipped items.",
    "workshop.rotate": "Rotate spinner",
    "workshop.elements": "Elements",
    "workshop.models": "Model",
    "workshop.colors": "Colors",
    "workshop.trails": "Trail",
    "workshop.auras": "Aura",
    "workshop.offers": "Premium",
    "workshop.owned": "Owned",
    "workshop.equipped": "Equipped",
    "workshop.buy": "Buy",
    "workshop.equip": "Equip",
    "workshop.previewing": "Previewing",
    "workshop.available": "Available",
    "workshop.premium": "Premium",
    "workshop.yan": "Yan",
    "workshop.unavailable": "Payments are unavailable",
    "workshop.insufficient": "Not enough parts",
    "workshop.modelLoadFailed": "Model could not be loaded. Using the default model.",
    "upgrade.maxRpm": "Maximum RPM",
    "upgrade.damage": "Damage",
    "upgrade.dash": "Dash cooldown",
    "upgrade.ultimate": "Charge",
    "common.back": "Back",
    "common.previous": "Previous",
    "common.next": "Next",
    "parts.name": "Parts",
    "unit.secondsShort": "sec",
    "result.victory": "Victory",
    "result.defeat": "Defeat",
    "result.place": "Place",
    "result.kills": "Kills",
    "result.earned": "Parts earned",
    "result.balance": "Balance",
    "result.replay": "Play again",
    "result.double": "Get x2 parts",
    "result.menu": "Main menu",
    "catalog.model.default": "Stock",
    "catalog.model.street": "Street",
    "catalog.model.turbo": "Turbo",
    "catalog.model.legend": "Legend",
    "catalog.model.neon": "Neon",
    "catalog.model.champion": "Champion",
    "catalog.color.default": "Factory blue",
    "catalog.color.red": "Racing red",
    "catalog.color.blue": "Electric blue",
    "catalog.color.green": "Toxic green",
    "catalog.color.violet": "Neon violet",
    "catalog.color.gold": "Workshop gold",
    "catalog.color.white": "White",
    "catalog.color.black": "Black",
    "catalog.color.gray": "Gray",
    "catalog.color.navy": "Navy",
    "catalog.color.darkGreen": "Dark green",
    "catalog.color.burgundy": "Burgundy",
    "catalog.color.orange": "Orange",
    "catalog.color.yellow": "Yellow",
    "catalog.color.pink": "Pink",
    "catalog.color.mint": "Mint",
    "catalog.color.lime": "Lime",
    "catalog.color.cyan": "Cyan",
    "catalog.color.lavender": "Lavender",
    "catalog.color.raspberry": "Raspberry",
    "catalog.trail.default": "White",
    "catalog.trail.fire": "Fire",
    "catalog.trail.ice": "Ice",
    "catalog.trail.toxic": "Toxic",
    "catalog.trail.neon": "Neon",
    "catalog.trail.gold": "Gold",
    "catalog.aura.none": "No aura",
    "catalog.aura.crit": "Critical aura",
    "catalog.aura.green": "Green aura",
    "catalog.aura.pink": "Pink aura",
    "catalog.aura.red": "Red aura",
    "catalog.aura.yellow": "Yellow aura",
    "offer.noAds": "No Ads",
    "offer.parts500": "500 parts",
    "offer.parts3000": "3000 parts",
    "common.level": "LVL",
    "menu.selectElement": "Select element",
    "element.fire": "Fire",
    "element.ice": "Ice",
    "element.earth": "Earth",
    "element.lightning": "Lightning",
    "hud.dash": "Dash",
    "hud.ultimate": "Ultimate",
    "hud.ready": "Ready",
    "hud.active": "Active",
    "hud.respawn": "Respawn",
    "hud.invulnerable": "Inv",
    "hud.continue": "Continue",
    "hud.continueIn": "Continue in",
    "hud.leaderboard": "Leaderboard",
    "hud.place": "Place",
    "hud.name": "Name",
    "hud.killsShort": "K",
    "hud.deathsShort": "D",
    "hud.critShort": "Crit",
    "hud.rating": "Rating",
    "orientation.rotate": "Rotate your device",
  },
  tr: {
    "game.title": "Turbo Spin Arena",
    "menu.mode": "Mod",
    "mode.multiplayer": "Çok oyunculu",
    "mode.survival": "Hayatta kalma",
    "mode.unavailable": "Yakında",
    "menu.settings": "Ayarlar",
    "settings.enemies": "Botlar",
    "settings.spinnerSize": "Boyut",
    "settings.botLevel": "Bot seviyesi",
    "bot.easy": "Kolay",
    "bot.normal": "Normal",
    "bot.hard": "Zor",
    "menu.start": "Başlat",
    "menu.selectElement": "Element seç",
    "element.fire": "Ateş",
    "element.ice": "Buz",
    "element.earth": "Toprak",
    "element.lightning": "Yıldırım",
  },
  es: {
    "game.title": "Turbo Spin Arena",
    "menu.mode": "Modo",
    "mode.multiplayer": "Multijugador",
    "mode.survival": "Supervivencia",
    "mode.unavailable": "Próximamente",
    "menu.settings": "Ajustes",
    "settings.enemies": "Bots",
    "settings.spinnerSize": "Tamaño",
    "settings.botLevel": "Nivel de bots",
    "bot.easy": "Fácil",
    "bot.normal": "Normal",
    "bot.hard": "Difícil",
    "menu.start": "Iniciar",
    "menu.selectElement": "Seleccionar elemento",
    "element.fire": "Fuego",
    "element.ice": "Hielo",
    "element.earth": "Tierra",
    "element.lightning": "Rayo",
  },
  pt: {
    "game.title": "Turbo Spin Arena",
    "menu.mode": "Modo",
    "mode.multiplayer": "Multijogador",
    "mode.survival": "Sobrevivência",
    "mode.unavailable": "Em breve",
    "menu.settings": "Configurações",
    "settings.enemies": "Bots",
    "settings.spinnerSize": "Tamanho",
    "settings.botLevel": "Nível dos bots",
    "bot.easy": "Fácil",
    "bot.normal": "Normal",
    "bot.hard": "Difícil",
    "menu.start": "Iniciar",
    "menu.selectElement": "Selecionar elemento",
    "element.fire": "Fogo",
    "element.ice": "Gelo",
    "element.earth": "Terra",
    "element.lightning": "Relâmpago",
  },
  ar: {
    "game.title": "Turbo Spin Arena",
    "menu.mode": "الوضع",
    "mode.multiplayer": "متعدد اللاعبين",
    "mode.survival": "البقاء",
    "mode.unavailable": "قريبًا",
    "menu.settings": "الإعدادات",
    "settings.enemies": "الروبوتات",
    "settings.spinnerSize": "الحجم",
    "settings.botLevel": "مستوى الروبوتات",
    "bot.easy": "سهل",
    "bot.normal": "عادي",
    "bot.hard": "صعب",
    "menu.start": "ابدأ",
    "menu.selectElement": "اختر العنصر",
    "element.fire": "النار",
    "element.ice": "الجليد",
    "element.earth": "الأرض",
    "element.lightning": "البرق",
  },
  id: {
    "game.title": "Turbo Spin Arena",
    "menu.mode": "Mode",
    "mode.multiplayer": "Multipemain",
    "mode.survival": "Bertahan hidup",
    "mode.unavailable": "Segera hadir",
    "menu.settings": "Pengaturan",
    "settings.enemies": "Bot",
    "settings.spinnerSize": "Ukuran",
    "settings.botLevel": "Level bot",
    "bot.easy": "Mudah",
    "bot.normal": "Normal",
    "bot.hard": "Sulit",
    "menu.start": "Mulai",
    "menu.selectElement": "Pilih elemen",
    "element.fire": "Api",
    "element.ice": "Es",
    "element.earth": "Tanah",
    "element.lightning": "Petir",
  },
  hi: {
    "game.title": "Turbo Spin Arena",
    "menu.mode": "मोड",
    "mode.multiplayer": "मल्टीप्लेयर",
    "mode.survival": "सर्वाइवल",
    "mode.unavailable": "जल्द आएगा",
    "menu.settings": "सेटिंग्स",
    "settings.enemies": "बॉट",
    "settings.spinnerSize": "आकार",
    "settings.botLevel": "बॉट स्तर",
    "bot.easy": "आसान",
    "bot.normal": "सामान्य",
    "bot.hard": "कठिन",
    "menu.start": "शुरू करें",
    "menu.selectElement": "तत्व चुनें",
    "element.fire": "आग",
    "element.ice": "बर्फ",
    "element.earth": "पृथ्वी",
    "element.lightning": "बिजली",
  },
  vi: {
    "game.title": "Turbo Spin Arena",
    "menu.mode": "Chế độ",
    "mode.multiplayer": "Nhiều người chơi",
    "mode.survival": "Sinh tồn",
    "mode.unavailable": "Sắp ra mắt",
    "menu.settings": "Cài đặt",
    "settings.enemies": "Bot",
    "settings.spinnerSize": "Kích thước",
    "settings.botLevel": "Cấp bot",
    "bot.easy": "Dễ",
    "bot.normal": "Thường",
    "bot.hard": "Khó",
    "menu.start": "Bắt đầu",
    "menu.selectElement": "Chọn nguyên tố",
    "element.fire": "Lửa",
    "element.ice": "Băng",
    "element.earth": "Đất",
    "element.lightning": "Sét",
  },
  zh: {
    "game.title": "Turbo Spin Arena",
    "menu.mode": "模式",
    "mode.multiplayer": "多人游戏",
    "mode.survival": "生存",
    "mode.unavailable": "即将推出",
    "menu.settings": "设置",
    "settings.enemies": "机器人",
    "settings.spinnerSize": "大小",
    "settings.botLevel": "机器人等级",
    "bot.easy": "简单",
    "bot.normal": "普通",
    "bot.hard": "困难",
    "menu.start": "开始",
    "menu.selectElement": "选择元素",
    "element.fire": "火",
    "element.ice": "冰",
    "element.earth": "土",
    "element.lightning": "雷电",
  },
  de: {
    "game.title": "Turbo Spin Arena",
    "menu.mode": "Modus",
    "mode.multiplayer": "Mehrspieler",
    "mode.survival": "Überleben",
    "mode.unavailable": "Bald verfügbar",
    "menu.settings": "Einstellungen",
    "settings.enemies": "Bots",
    "settings.spinnerSize": "Größe",
    "settings.botLevel": "Bot-Stufe",
    "bot.easy": "Einfach",
    "bot.normal": "Normal",
    "bot.hard": "Schwer",
    "menu.start": "Start",
    "menu.selectElement": "Element wählen",
    "element.fire": "Feuer",
    "element.ice": "Eis",
    "element.earth": "Erde",
    "element.lightning": "Blitz",
  },
  fr: {
    "game.title": "Turbo Spin Arena",
    "menu.mode": "Mode",
    "mode.multiplayer": "Multijoueur",
    "mode.survival": "Survie",
    "mode.unavailable": "Bientôt disponible",
    "menu.settings": "Paramètres",
    "settings.enemies": "Bots",
    "settings.spinnerSize": "Taille",
    "settings.botLevel": "Niveau des bots",
    "bot.easy": "Facile",
    "bot.normal": "Normal",
    "bot.hard": "Difficile",
    "menu.start": "Démarrer",
    "menu.selectElement": "Choisir un élément",
    "element.fire": "Feu",
    "element.ice": "Glace",
    "element.earth": "Terre",
    "element.lightning": "Foudre",
  },
};

export function detectLanguage(language: string): LanguageCode {
  const normalized = language.toLowerCase().split("-")[0];
  return isLanguageCode(normalized) ? normalized : "en";
}

export function createTranslator(language: LanguageCode): (key: TranslationKey) => string {
  return (key) => translations[language][key] ?? translations.en[key] ?? key;
}

function isLanguageCode(language: string): language is LanguageCode {
  return language in translations;
}
