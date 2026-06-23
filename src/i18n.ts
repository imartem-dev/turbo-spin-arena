export type LanguageCode = "ru" | "en" | "tr" | "es" | "pt" | "ar" | "id" | "hi" | "vi" | "zh" | "de" | "fr";

type TranslationKey =
  | "game.title"
  | "menu.mode"
  | "mode.multiplayer"
  | "mode.survival"
  | "mode.unavailable"
  | "menu.settings"
  | "settings.enemies"
  | "settings.spinnerSize"
  | "settings.botLevel"
  | "settings.light"
  | "settings.lightToggle"
  | "settings.lightDisabled"
  | "settings.lightAmbient"
  | "settings.lightHemisphere"
  | "settings.lightKey"
  | "settings.lightFill"
  | "bot.easy"
  | "bot.normal"
  | "bot.hard"
  | "menu.start"
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
  | "hud.continueIn";

type TranslationTable = Partial<Record<TranslationKey, string>>;

const translations: Record<LanguageCode, TranslationTable> = {
  ru: {
    "game.title": "Turbo Spin Arena",
    "menu.mode": "Режим",
    "mode.multiplayer": "Мультиплеер",
    "mode.survival": "Выживание",
    "mode.unavailable": "Скоро",
    "menu.settings": "Настройки",
    "settings.enemies": "Боты",
    "settings.spinnerSize": "Размер",
    "settings.botLevel": "Уровень ботов",
    "settings.light": "Свет",
    "settings.lightToggle": "Показать или скрыть настройки света",
    "settings.lightDisabled": "Выключить свет",
    "settings.lightAmbient": "Общий",
    "settings.lightHemisphere": "Небо",
    "settings.lightKey": "Ключ",
    "settings.lightFill": "Заливка",
    "bot.easy": "Легко",
    "bot.normal": "Нормально",
    "bot.hard": "Сложно",
    "menu.start": "Старт",
    "menu.selectElement": "Выбор элемента",
    "element.fire": "Огонь",
    "element.ice": "Лёд",
    "element.earth": "Земля",
    "element.lightning": "Молния",
  },
  en: {
    "game.title": "Turbo Spin Arena",
    "menu.mode": "Mode",
    "mode.multiplayer": "Multiplayer",
    "mode.survival": "Survival",
    "mode.unavailable": "Soon",
    "menu.settings": "Settings",
    "settings.enemies": "Bots",
    "settings.spinnerSize": "Size",
    "settings.botLevel": "Bot level",
    "settings.light": "Light",
    "settings.lightToggle": "Show or hide light settings",
    "settings.lightDisabled": "Disable all light",
    "settings.lightAmbient": "Ambient",
    "settings.lightHemisphere": "Hemi",
    "settings.lightKey": "Key",
    "settings.lightFill": "Fill",
    "bot.easy": "Easy",
    "bot.normal": "Normal",
    "bot.hard": "Hard",
    "menu.start": "Start",
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
