import { pipeline } from '@huggingface/transformers';
import { TONE_CONFIG } from '../utils/config.js';
import { isWebGPUSupported, logError } from '../utils/common.js';

// Database fakta cadangan berkualitas tinggi untuk menjamin 100% konten relevan
const FALLBACK_FACTS = {
  Beetroot: {
    normal: 'Beetroot has been used since ancient times not just as food, but also as a natural red dye and even for medicinal purposes.',
    funny: 'Eat too much beetroot and you might get a fright in the bathroom! It can turn your urine pink or red, a harmless condition called beeturia.',
    professional: 'Beetroot is rich in inorganic nitrates, which the human body converts into nitric oxide, a compound that relaxes blood vessels and improves blood flow.',
    casual: 'Did you know beetroots are super sweet? They actually have the highest sugar content of all vegetables, even though they are low in calories!',
  },
  Paprika: {
    normal: 'Paprika is made from ground, dried pods of bell peppers or chili peppers, and is rich in Vitamin A and carotenoids.',
    funny: 'Paprika is basically bell peppers that went to a spa, got dried, and then pulverized into a delicious red dust of flavor!',
    professional: 'Capsicum annuum, from which paprika is produced, contains capsaicin in varying amounts, acting as a potential anti-inflammatory agent.',
    casual: 'Paprika is awesome! Just a single tablespoon of it gives you more than 100% of your daily recommended intake of Vitamin A.',
  },
  Cabbage: {
    normal: 'Cabbage is a leafy green or purple biennial plant grown as an annual vegetable for its dense-leaved heads.',
    funny: 'Cabbage is the legendary vegetable that can survive almost anything, but it might make your kitchen smell like a hot spring if you overcook it!',
    professional: 'Cabbage contains high levels of glucosinolates, which are sulfur-containing compounds metabolized into active cancer-preventive substances.',
    casual: 'Cabbage is super old-school! Humans have been growing and eating it for over 4,000 years, making it one of the oldest cultivated crops.',
  },
  Carrot: {
    normal: 'Carrots are root vegetables that are highly rich in beta-carotene, which is metabolized into Vitamin A in the body.',
    funny: 'Carrots were originally purple and yellow! The orange carrot we love today was bred in the Netherlands as a tribute to William of Orange.',
    professional: 'The high concentration of beta-carotene in carrots acts as a powerful antioxidant, protecting cells from free radical damage.',
    casual: 'Carrots are great for your eyes, but eating too many of them can actually turn your skin slightly orange!',
  },
  Cauliflower: {
    normal: 'Cauliflower is a cruciferous vegetable where the head (called the curd) is made of undeveloped flower buds.',
    funny: 'Cauliflower is basically broccoli\'s pale, introverted cousin that somehow managed to become a trendy low-carb pizza crust!',
    professional: 'Cauliflower is an excellent source of vitamin C and folate, containing glucosinolates that support cellular detoxification.',
    casual: 'Cauliflowers come in cool colors! You can find purple, orange, and green cauliflowers at specialty markets.',
  },
  Chilli: {
    normal: 'Chilli peppers contain capsaicin, the chemical compound that stimulates chemesthetic receptors to produce a burning sensation.',
    funny: 'Chillies use chemical warfare to prevent animals from eating them, but humans decided that painful burning sensation is absolutely delicious!',
    professional: 'Capsaicin binds to pain receptors in the mouth, triggering endorphin release, which acts as a natural painkiller and mood elevator.',
    casual: 'Did you know bird droppings don\'t feel the heat of chillies? Birds lack the receptors for capsaicin, allowing them to spread chilli seeds far and wide.',
  },
  Corn: {
    normal: 'Corn, also known as maize, is a cereal grain first domesticated by indigenous peoples in southern Mexico about 10,000 years ago.',
    funny: 'An average ear of corn has an even number of rows, usually 16, which means corn is extremely organized and good at math!',
    professional: 'Zea mays is a C4 plant, making it highly efficient at photosynthesis and a primary carbohydrate source globally.',
    casual: 'Corn is grown on every continent except Antarctica. It is used in everything from cornflakes to biodegradable plastics and fuel!',
  },
  Cucumber: {
    normal: 'Cucumbers are scientifically fruits, though culinary vegetables, and consist of about 95% water, making them incredibly hydrating.',
    funny: 'Cucumbers are so cool they can actually lower the temperature of your mouth by up to 20 degrees, which is where the phrase "cool as a cucumber" comes from!',
    professional: 'The skin of Cucumis sativus contains silica, a trace mineral essential for maintaining healthy connective tissue, skin, and nails.',
    casual: 'Want to get rid of bad breath? Press a cucumber slice to the roof of your mouth for 30 seconds to kill odor-causing bacteria!',
  },
  eggplant: {
    normal: 'Eggplant, or aubergine, is a species of nightshade grown for its purple edible fruit, which is botanically classified as a berry.',
    funny: 'Eggplants got their name because the 18th-century European cultivars looked exactly like small, white goose eggs hanging from the branches!',
    professional: 'Solanum melongena is rich in anthocyanins, specifically nasunin, which protects brain cell membranes from lipid peroxidation.',
    casual: 'Eggplants are technically berries, and they actually contain a tiny amount of nicotine, though you\'d have to eat 20 pounds of it to equal a single cigarette!',
  },
  Garlic: {
    normal: 'Garlic is a species in the onion genus, Allium, and has been used for thousands of years for both culinary and medicinal properties.',
    funny: 'Garlic is the ultimate shield against vampires, bad dates, and low blood pressure! Just remember to share the garlic bread to avoid lonely breath.',
    professional: 'Allicin, the active organosulfur compound in garlic, is released upon crushing or chopping, exhibiting strong antimicrobial properties.',
    casual: 'Garlic can help keep mosquitoes away! Eating garlic releases sulfur compounds through your skin, which mosquitoes absolutely hate.',
  },
  Ginger: {
    normal: 'Ginger is a flowering plant whose rhizome, ginger root or ginger, is widely used as a spice and a folk medicine.',
    funny: 'Ginger is the spicy root that acts like a seatbelt for your stomach, preventing motion sickness and nausea during bumpy rides!',
    professional: 'Zingiber officinale contains bioactive compounds like gingerol, which have potent anti-inflammatory and antioxidant effects.',
    casual: 'Ginger is so versatile! It can be eaten fresh, dried, powdered, as an oil, or even pickled as a palate cleanser for sushi.',
  },
  Lettuce: {
    normal: 'Lettuce is a leafy herbaceous annual plant of the daisy family, Asteraceae, most often grown as a leaf vegetable.',
    funny: 'Lettuce is mostly water, meaning you are basically eating structured, crunchy water that makes you feel healthy!',
    professional: 'Lactuca sativa contains lactucarium, a milky fluid that has mild sedative properties, historically used to promote sleep.',
    casual: 'Ancient Egyptians actually associated lettuce with fertility and sacred strength, cultivating it for its oil-rich seeds first.',
  },
  Onion: {
    normal: 'Onions contain sulfur compounds that form sulfenic acids when cut, which then turn into a gas that irritates the eyes and causes tears.',
    funny: 'Onions are the only vegetable capable of making you cry without saying a single mean word to you!',
    professional: 'Onions are highly concentrated in quercetin, a flavonoid antioxidant that supports cardiovascular health and immune function.',
    casual: 'To stop crying while cutting onions, try chilling them in the fridge beforehand or chewing gum to redirect your breathing!',
  },
  Peas: {
    normal: 'Peas are small spherical seeds or seed-pods of the pod fruit Pisum sativum, belonging to the legume family.',
    funny: 'Peas are highly social! They love hanging out in pods, and were used by Gregor Mendel to discover the basic laws of genetics.',
    professional: 'Pisum sativum is an excellent source of plant-based protein, dietary fiber, and essential micronutrients like Vitamin K.',
    casual: 'The oldest pea ever found was preserved in an archaeological site in Thailand and is estimated to be over 11,000 years old!',
  },
  Potato: {
    normal: 'Potatoes are starchy tubers of the plant Solanum tuberosum, and are the world\'s fourth-largest food crop after rice, wheat, and maize.',
    funny: 'Potatoes were the first vegetable to be grown in outer space! They went aboard the Space Shuttle Columbia in 1995.',
    professional: 'Solanum tuberosum provides a highly bioavailable source of potassium and complex carbohydrates, essential for muscle recovery.',
    casual: 'Potatoes are incredibly sustainable! They require much less water and land to grow compared to grains like rice or wheat.',
  },
  Turnip: {
    normal: 'Turnips are root vegetables commonly grown in temperate climates worldwide for their white, fleshy taproots.',
    funny: 'Before pumpkins took over, the Irish carved turnips to make jack-o\'-lanterns for Halloween to scare away evil spirits!',
    professional: 'Brassica rapa is low in calories but exceptionally high in Vitamin C, promoting skin health and immune resistance.',
    casual: 'Both the roots and the green leaves of turnips are edible and packed with nutrients, making them a zero-waste vegetable!',
  },
  Soybean: {
    normal: 'Soybean is a species of legume native to East Asia, widely grown for its edible bean, which has numerous uses including tofu and soy sauce.',
    funny: 'Soybeans are the ultimate actors of the food world. They can pretend to be milk, cheese, meat, oil, and even candles!',
    professional: 'Glycine max is unique among plant foods as it contains all nine essential amino acids, making it a complete protein source.',
    casual: 'Soybeans are incredibly versatile! They are used to make crayons, engine lubricants, and even environmentally friendly inks.',
  },
  Spinach: {
    normal: 'Spinach is a green leafy flowering plant native to central and western Asia, rich in iron, calcium, and vitamins.',
    funny: 'Spinach\'s famous high-iron reputation was partly due to a misplaced decimal point in an 1870 calculation, but it is still super healthy!',
    professional: 'Spinacia oleracea contains high amounts of lutein and zeaxanthin, carotenoids that accumulate in the retina to protect eye health.',
    casual: 'Popeye the Sailor Man boosted U.S. spinach consumption by 33% in the 1930s, helping save the spinach industry during the Great Depression.',
  },
};

// Kata kunci validasi untuk memastikan hasil model relevan dengan sayuran yang dideteksi
const VEGETABLE_KEYWORDS = {
  Beetroot: ['beet', 'root', 'red', 'sweet', 'blood', 'beeturia'],
  Paprika: ['paprika', 'pepper', 'bell', 'sweet', 'spice', 'capsicum'],
  Cabbage: ['cabbage', 'leaf', 'leaves', 'green', 'head', 'brassica'],
  Carrot: ['carrot', 'orange', 'root', 'vision', 'eye', 'carotene', 'vitamin'],
  Cauliflower: ['cauliflower', 'flower', 'white', 'head', 'cabbage', 'curd', 'brassica'],
  Chilli: ['chilli', 'chili', 'hot', 'spicy', 'capsaicin', 'pepper'],
  Corn: ['corn', 'maize', 'cob', 'yellow', 'kernel', 'row'],
  Cucumber: ['cucumber', 'water', 'cool', 'green', 'pickle', 'cucumis'],
  eggplant: ['eggplant', 'aubergine', 'purple', 'berry', 'egg', 'egg-plant', 'solanum'],
  Garlic: ['garlic', 'bulb', 'clove', 'allium', 'smell', 'allicin'],
  Ginger: ['ginger', 'rhizome', 'root', 'spice', 'gingerol', 'zingiber'],
  Lettuce: ['lettuce', 'leaf', 'leaves', 'salad', 'green', 'lactuca'],
  Onion: ['onion', 'bulb', 'tear', 'allium', 'cry', 'crying'],
  Peas: ['pea', 'pod', 'green', 'legume', 'pisum'],
  Potato: ['potato', 'tuber', 'starch', 'solanum'],
  Turnip: ['turnip', 'root', 'white', 'purple', 'brassica'],
  Soybean: ['soy', 'bean', 'edamame', 'tofu', 'legume', 'glycine', 'soybean', 'soybeans'],
  Spinach: ['spinach', 'popeye', 'iron', 'leaf', 'leaves', 'green', 'spinacia'],
};

// Konfigurasi prompt berdasarkan tone/persona
const TONE_PROMPTS = {
  normal: (veg) =>
    `Write a unique and interesting fun fact about ${veg} as a vegetable. Ensure it focuses directly on ${veg} and keep it under 25 words.`,
  funny: (veg) =>
    `Write a funny, humorous, and entertaining joke or fact specifically about ${veg}. Keep it under 25 words.`,
  professional: (veg) =>
    `Provide a professional, scientific, or nutritional fact about the vegetable ${veg}. Keep it under 25 words.`,
  casual: (veg) =>
    `Share a cool and surprising fact about the vegetable ${veg} in a friendly, casual tone. Keep it under 25 words.`,
};

export class RootFactsService {
  constructor() {
    this.generator = null;
    this.isModelLoaded = false;
    this.isGenerating = false;
    this.config = null;
    this.currentBackend = null;
    this.currentTone = TONE_CONFIG.defaultTone;
  }

  // [Basic] Muat model dan inisialisasi pipeline text2text-generation
  // [Advance] Implementasikan strategi Backend Adaptive
  async loadModel(onProgress) {
    try {
      if (onProgress) onProgress('Memuat model bahasa...', 10);

      // Backend Adaptive: WebGPU → CPU
      let device = 'cpu';
      if (isWebGPUSupported()) {
        try {
          device = 'webgpu';
          console.log('✅ Transformers.js menggunakan WebGPU');
        } catch {
          device = 'cpu';
          console.warn('⚠️ WebGPU tidak tersedia untuk Transformers.js, menggunakan CPU');
        }
      }

      this.currentBackend = device;

      // Inisialisasi pipeline text-generation dengan model kecil
      this.generator = await pipeline(
        'text2text-generation',
        'Xenova/flan-t5-small',
        {
          dtype: 'q4',
          device,
          progress_callback: (progress) => {
            if (onProgress && progress.progress !== undefined) {
              const pct = Math.round(progress.progress);
              onProgress(`Memuat model AI... ${pct}%`, pct);
            }
          },
        }
      );

      this.isModelLoaded = true;
      if (onProgress) onProgress('Model AI Siap', 100);
      console.log(`✅ Transformers.js pipeline siap (backend: ${device})`);

      return true;
    } catch (error) {
      logError('RootFactsService.loadModel', error);
      throw error;
    }
  }

  // [Advance] Konfigurasi tone fakta yang dihasilkan
  setTone(tone) {
    if (TONE_CONFIG.availableTones.some((t) => t.value === tone)) {
      this.currentTone = tone;
      console.log(`✅ Tone diubah ke: ${tone}`);
    }
  }

  // Validasi teks hasil generasi model AI
  validateFact(text, vegetableName) {
    if (!text || text.trim().length < 10) return false;

    const lowerText = text.toLowerCase();
    const lowerVeg = vegetableName.toLowerCase();

    // Wajib mengandung nama sayurannya atau minimal salah satu kata kunci sayuran tersebut
    if (lowerText.includes(lowerVeg)) return true;

    const keywords = VEGETABLE_KEYWORDS[vegetableName] || [];
    const hasKeyword = keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));

    return hasKeyword;
  }

  // Dapatkan fakta cadangan dari database lokal jika generasi gagal/tidak relevan
  getFallbackFact(vegetableName) {
    const vegFacts = FALLBACK_FACTS[vegetableName] || FALLBACK_FACTS.Soybean; // Fallback ke Soybean jika tidak terdefinisi
    return vegFacts[this.currentTone] || vegFacts.normal;
  }

  // [Basic] Lakukan prediksi pada elemen gambar yang diberikan dan kembalikan hasilnya
  // [Skilled] Konfigurasikan parameter generasi berdasarkan kebutuhan
  // [Advance] Implemenasikan parameter tone untuk mengatur nada fakta yang dihasilkan
  async generateFacts(vegetableName) {
    if (!this.isReady()) {
      throw new Error('Model belum dimuat');
    }

    if (this.isGenerating) {
      return null; // Hindari request ganda
    }

    this.isGenerating = true;

    try {
      // Normalisasi nama sayuran agar sesuai key (misal 'eggplant' -> 'eggplant')
      let mappedVegName = vegetableName;
      if (vegetableName.toLowerCase() === 'eggplant') {
        mappedVegName = 'eggplant';
      } else {
        // Cari key yang case-insensitive cocok
        const matchedKey = Object.keys(FALLBACK_FACTS).find(
          (key) => key.toLowerCase() === vegetableName.toLowerCase()
        );
        if (matchedKey) mappedVegName = matchedKey;
      }

      const promptFn = TONE_PROMPTS[this.currentTone] || TONE_PROMPTS.normal;
      const prompt = promptFn(mappedVegName);

      console.log(`🧠 Generating fact for: ${mappedVegName} (tone: ${this.currentTone})`);

      // Lakukan hingga 3 kali percobaan generasi jika hasil tidak relevan (retry logic)
      let finalFact = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        // Eksperimen parameter: gunakan temperature rendah (0.2 - 0.4) agar lebih deterministik
        const temp = 0.2 + (attempt - 1) * 0.1; // Attempt 1: 0.2, Attempt 2: 0.3, Attempt 3: 0.4

        try {
          const results = await this.generator(prompt, {
            max_new_tokens: 100,
            temperature: temp,
            top_p: 0.9,
            do_sample: attempt > 1, // Attempt pertama sangat deterministik, attempt berikutnya pakai sampling ringan
            repetition_penalty: 1.3,
          });

          if (results && results.length > 0) {
            const text = (results[0].generated_text || results[0].translation_text || '').trim();

            // Validasi apakah hasil generasi relevan
            if (this.validateFact(text, mappedVegName)) {
              finalFact = text;
              console.log(`✅ Attempt ${attempt} succeeded: "${finalFact}"`);
              break;
            } else {
              console.warn(`⚠️ Attempt ${attempt} failed validation: "${text}"`);
            }
          }
        } catch (err) {
          console.error(`❌ Error on attempt ${attempt}:`, err);
        }
      }

      // Jika semua percobaan gagal/tidak valid, gunakan fallback dari database lokal berkualitas tinggi
      if (!finalFact) {
        finalFact = this.getFallbackFact(mappedVegName);
        console.log(`ℹ️ Using high-quality fallback fact for ${mappedVegName}: "${finalFact}"`);
      }

      return finalFact;
    } catch (error) {
      logError('RootFactsService.generateFacts', error);
      throw error;
    } finally {
      this.isGenerating = false;
    }
  }

  // [Basic] Periksa apakah model sudah dimuat dan siap digunakan
  isReady() {
    return this.isModelLoaded && this.generator !== null;
  }
}
