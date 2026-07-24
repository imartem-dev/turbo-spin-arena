import arTranslations from "./locales/localization-ar.json";
import deTranslations from "./locales/localization-de.json";
import enTranslations from "./locales/localization-en.json";
import esTranslations from "./locales/localization-es.json";
import frTranslations from "./locales/localization-fr.json";
import hiTranslations from "./locales/localization-hi.json";
import idTranslations from "./locales/localization-id.json";
import ptTranslations from "./locales/localization-pt.json";
import trTranslations from "./locales/localization-tr.json";
import viTranslations from "./locales/localization-vi.json";
import zhTranslations from "./locales/localization-zh.json";

export type LanguageCode = "ru" | "en" | "tr" | "es" | "pt" | "ar" | "id" | "hi" | "vi" | "zh" | "de" | "fr";
export type ActiveLanguageCode = LanguageCode;

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
  | "rewards.title"
  | "rewards.open"
  | "rewards.claimed"
  | "rewards.received"
  | "rewards.parts"
  | "rewards.color"
  | "rewards.trail"
  | "rewards.aura"
  | "rewards.model"
  | "rewards.compensation"
  | "rewards.continue"
  | "rewards.close"
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
  | "result.earned"
  | "result.balance"
  | "result.replay"
  | "result.double"
  | "result.doubleClaimed"
  | "result.menu"
  | "auth.open"
  | "auth.title"
  | "auth.benefit"
  | "auth.confirm"
  | "auth.cancel"
  | "auth.success"
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
  | "catalog.color.bronze"
  | "catalog.color.sand"
  | "catalog.color.azure"
  | "catalog.color.silver"
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
  | "catalog.aura.one"
  | "catalog.aura.two"
  | "catalog.aura.three"
  | "offer.noAds"
  | "offer.parts500"
  | "offer.parts3000"
  | "offer.parts7500"
  | "offer.parts21000"
  | "offer.parts21000Aura3"
  | "offer.parts50000"
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
  | "hud.player"
  | "hud.bot"
  | "hud.opponentLesnoyVolk"
  | "hud.opponentTihiyGrom"
  | "hud.opponentZloyBublik"
  | "hud.opponentKotVTapkah"
  | "hud.opponentDedMorozik"
  | "hud.opponentBorodatiyBoss"
  | "hud.opponentSuroviyGus"
  | "hud.opponentNochnoyBogatyr"
  | "hud.opponentChudesniyLos"
  | "hud.opponentHrabriyPirozhok"
  | "hud.health"
  | "hud.move"
  | "bonus.speed"
  | "bonus.critSpeed"
  | "bonus.critDamage"
  | "bonus.damage"
  | "bonus.heal"
  | "orientation.rotate";

type TranslationTable = Partial<Record<TranslationKey, string>>;

const translations: Record<LanguageCode, TranslationTable> = {
  ru: {
    "game.title": "Битва спиннеров",
    "menu.mode": "Режим",
    "mode.multiplayer": "Мультиплеер",
    "mode.duel": "1 на 1",
    "mode.deathmatch": "Арена",
    "mode.survival": "Выживание",
    "mode.unavailable": "Скоро",
    "mode.duelDescription": "Выбей соперника за пределы арены",
    "mode.deathmatchDescription": "Останься последним спиннером на арене",
    "mode.survivalDescription": "Продержись против волн врагов",
    "menu.settings": "Настройки",
    "settings.enemies": "Боты",
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
    "rewards.title": "Сундуки за время",
    "rewards.open": "Открыть",
    "rewards.claimed": "Получено",
    "rewards.received": "Награда получена",
    "rewards.parts": "Детали",
    "rewards.color": "Цвет",
    "rewards.trail": "След",
    "rewards.aura": "Аура",
    "rewards.model": "Модель",
    "rewards.compensation": "Компенсация",
    "rewards.continue": "Продолжить",
    "rewards.close": "Закрыть награды",
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
    "result.earned": "Награда",
    "result.balance": "Баланс",
    "result.replay": "Играть снова",
    "result.double": "Награда ×2",
    "result.doubleClaimed": "Награда получена",
    "result.menu": "Главное меню",
    "auth.open": "Сохранить в облаке",
    "auth.title": "Сохранить прогресс в облаке?",
    "auth.benefit": "После входа прогресс будет доступен на других устройствах. Без входа можно продолжить играть как гость.",
    "auth.confirm": "Войти",
    "auth.cancel": "Остаться гостем",
    "auth.success": "Облачное сохранение включено",
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
    "catalog.color.bronze": "Бронзовый",
    "catalog.color.sand": "Песочный",
    "catalog.color.azure": "Лазурный",
    "catalog.color.silver": "Серебристый",
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
    "catalog.aura.one": "Аура 1",
    "catalog.aura.two": "Аура 2",
    "catalog.aura.three": "Аура 3",
    "offer.noAds": "Без рекламы",
    "offer.parts500": "500",
    "offer.parts3000": "3000",
    "offer.parts7500": "7 500",
    "offer.parts21000": "21 000",
    "offer.parts21000Aura3": "21 000 + аура",
    "offer.parts50000": "50 000",
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
    "hud.player": "Игрок",
    "hud.bot": "Бот",
    "hud.opponentLesnoyVolk": "LesnoyVolk",
    "hud.opponentTihiyGrom": "TihiyGrom",
    "hud.opponentZloyBublik": "ZloyBublik",
    "hud.opponentKotVTapkah": "KotVTapkah",
    "hud.opponentDedMorozik": "DedMorozik",
    "hud.opponentBorodatiyBoss": "BorodatiyBoss",
    "hud.opponentSuroviyGus": "SuroviyGus",
    "hud.opponentNochnoyBogatyr": "NochnoyBogatyr",
    "hud.opponentChudesniyLos": "ChudesniyLos",
    "hud.opponentHrabriyPirozhok": "HrabriyPirozhok",
    "hud.health": "ОЗ",
    "hud.move": "Движение",
    "bonus.speed": "Бонус скорости",
    "bonus.critSpeed": "Бонус критической скорости",
    "bonus.critDamage": "Бонус критического урона",
    "bonus.damage": "Бонус урона",
    "bonus.heal": "Лечение",
    "orientation.rotate": "Поверни устройство",
  },
  en: {
    "game.title": "Spinner Battle",
    "menu.mode": "Mode",
    "mode.multiplayer": "Multiplayer",
    "mode.duel": "1v1",
    "mode.deathmatch": "Arena",
    "mode.survival": "Survival",
    "mode.unavailable": "Soon",
    "mode.duelDescription": "Knock your opponent out of the arena",
    "mode.deathmatchDescription": "Be the last spinner standing in the arena",
    "mode.survivalDescription": "Hold out against enemy waves",
    "menu.settings": "Settings",
    "settings.enemies": "Bots",
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
    "rewards.title": "Timed chests",
    "rewards.open": "Open",
    "rewards.claimed": "Claimed",
    "rewards.received": "Reward received",
    "rewards.parts": "Parts",
    "rewards.color": "Color",
    "rewards.trail": "Trail",
    "rewards.aura": "Aura",
    "rewards.model": "Model",
    "rewards.compensation": "Compensation",
    "rewards.continue": "Continue",
    "rewards.close": "Close rewards",
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
    "result.earned": "Reward",
    "result.balance": "Balance",
    "result.replay": "Play again",
    "result.double": "Reward ×2",
    "result.doubleClaimed": "Reward claimed",
    "result.menu": "Main menu",
    "auth.open": "Cloud save",
    "auth.title": "Save progress in the cloud?",
    "auth.benefit": "Signing in makes progress available on your other devices. You can keep playing as a guest without signing in.",
    "auth.confirm": "Sign in",
    "auth.cancel": "Continue as guest",
    "auth.success": "Cloud saves enabled",
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
    "catalog.color.bronze": "Bronze",
    "catalog.color.sand": "Sand",
    "catalog.color.azure": "Azure",
    "catalog.color.silver": "Silver",
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
    "catalog.aura.one": "Aura 1",
    "catalog.aura.two": "Aura 2",
    "catalog.aura.three": "Aura 3",
    "offer.noAds": "No Ads",
    "offer.parts500": "500",
    "offer.parts3000": "3000",
    "offer.parts7500": "7,500",
    "offer.parts21000": "21,000",
    "offer.parts21000Aura3": "21,000 + Aura",
    "offer.parts50000": "50,000",
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
    "hud.player": "Player",
    "hud.bot": "Bot",
    "hud.health": "HP",
    "hud.move": "Move",
    "bonus.speed": "Speed bonus",
    "bonus.critSpeed": "Critical speed bonus",
    "bonus.critDamage": "Critical damage bonus",
    "bonus.damage": "Damage bonus",
    "bonus.heal": "Healing",
    "orientation.rotate": "Rotate your device",
  },
  tr: {
    "game.title": "Spinner Savaşı",
    "menu.mode": "Mod",
    "mode.multiplayer": "Çok oyunculu",
    "mode.survival": "Hayatta kalma",
    "mode.unavailable": "Yakında",
    "menu.settings": "Ayarlar",
    "settings.enemies": "Botlar",
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
    "game.title": "Batalla de Spinners",
    "menu.mode": "Modo",
    "mode.multiplayer": "Multijugador",
    "mode.survival": "Supervivencia",
    "mode.unavailable": "Próximamente",
    "menu.settings": "Ajustes",
    "settings.enemies": "Bots",
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
    "game.title": "Batalha de Spinners",
    "menu.mode": "Modo",
    "mode.multiplayer": "Multijogador",
    "mode.survival": "Sobrevivência",
    "mode.unavailable": "Em breve",
    "menu.settings": "Configurações",
    "settings.enemies": "Bots",
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
    "game.title": "معركة السبينرز",
    "menu.mode": "الوضع",
    "mode.multiplayer": "متعدد اللاعبين",
    "mode.survival": "البقاء",
    "mode.unavailable": "قريبًا",
    "menu.settings": "الإعدادات",
    "settings.enemies": "الروبوتات",
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
    "game.title": "Pertarungan Spinner",
    "menu.mode": "Mode",
    "mode.multiplayer": "Multipemain",
    "mode.survival": "Bertahan hidup",
    "mode.unavailable": "Segera hadir",
    "menu.settings": "Pengaturan",
    "settings.enemies": "Bot",
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
    "game.title": "स्पिनर बैटल",
    "menu.mode": "मोड",
    "mode.multiplayer": "मल्टीप्लेयर",
    "mode.survival": "सर्वाइवल",
    "mode.unavailable": "जल्द आएगा",
    "menu.settings": "सेटिंग्स",
    "settings.enemies": "बॉट",
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
    "game.title": "Đại Chiến Spinner",
    "menu.mode": "Chế độ",
    "mode.multiplayer": "Nhiều người chơi",
    "mode.survival": "Sinh tồn",
    "mode.unavailable": "Sắp ra mắt",
    "menu.settings": "Cài đặt",
    "settings.enemies": "Bot",
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
    "game.title": "陀螺对战",
    "menu.mode": "模式",
    "mode.multiplayer": "多人游戏",
    "mode.survival": "生存",
    "mode.unavailable": "即将推出",
    "menu.settings": "设置",
    "settings.enemies": "机器人",
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
    "game.title": "Kreisel-Battle",
    "menu.mode": "Modus",
    "mode.multiplayer": "Mehrspieler",
    "mode.survival": "Überleben",
    "mode.unavailable": "Bald verfügbar",
    "menu.settings": "Einstellungen",
    "settings.enemies": "Bots",
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
    "game.title": "Combat de Spinners",
    "menu.mode": "Mode",
    "mode.multiplayer": "Multijoueur",
    "mode.survival": "Survie",
    "mode.unavailable": "Bientôt disponible",
    "menu.settings": "Paramètres",
    "settings.enemies": "Bots",
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

Object.assign(translations.ar, arTranslations);
Object.assign(translations.de, deTranslations);
Object.assign(translations.en, enTranslations);
Object.assign(translations.es, esTranslations);
Object.assign(translations.fr, frTranslations);
Object.assign(translations.hi, hiTranslations);
Object.assign(translations.id, idTranslations);
Object.assign(translations.pt, ptTranslations);
Object.assign(translations.tr, trTranslations);
Object.assign(translations.vi, viTranslations);
Object.assign(translations.zh, zhTranslations);

export const supportedLanguages: ReadonlyArray<{ code: LanguageCode; name: string }> = [
  { code: "ru", name: "Русский" },
  { code: "en", name: "English" },
  { code: "tr", name: "Türkçe" },
  { code: "es", name: "Español" },
  { code: "pt", name: "Português" },
  { code: "ar", name: "العربية" },
  { code: "id", name: "Bahasa Indonesia" },
  { code: "hi", name: "हिन्दी" },
  { code: "vi", name: "Tiếng Việt" },
  { code: "zh", name: "简体中文" },
  { code: "de", name: "Deutsch" },
  { code: "fr", name: "Français" },
];

const supportedLanguageCodes = new Set<LanguageCode>(supportedLanguages.map(({ code }) => code));

export function detectLanguage(language: string): ActiveLanguageCode {
  const normalized = language.toLowerCase().split("-")[0];
  return supportedLanguageCodes.has(normalized as LanguageCode) ? normalized as LanguageCode : "ru";
}

export function createTranslator(language: ActiveLanguageCode): (key: TranslationKey) => string {
  return (key) => translations[language][key] || translations.ru[key] || key;
}
