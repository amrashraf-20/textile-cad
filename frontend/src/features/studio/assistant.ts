/**
 * Textile CAD Studio Assistant Engine.
 *
 * Implements a senior textile engineering assistant capable of:
 * 1. Answering conversational questions, greetings, and technical inquiries (GSM, yarn counts, twill vs satin, reed math).
 * 2. Recognizing fabric domain products (Denim, Gabardine, Oxford, Houndstooth, Terry, Waffle).
 * 3. Extracting and combining multi-intent actions (structures, colors, grid sizes, drafting, calculations).
 * 4. Serving as an expert fallback when offline or when no OpenRouter key is configured.
 */

import { COLORWAYS as COLORWAY_CATALOG, STRUCTURES, structureById, type StructureOptions } from './draft'

export type AssistantAction =
  | { type: 'applyStructure'; id: string; options?: StructureOptions }
  | { type: 'colorway'; id: string }
  | { type: 'setColors'; warp?: string; weft?: string }
  | { type: 'resize'; warpEnds: number; weftPicks: number }
  | { type: 'clear' }
  | { type: 'openDraft' }
  | { type: 'navigate'; to: string }

export interface AssistantReply {
  reply: string
  actions: AssistantAction[]
}

export interface AssistantContext {
  locale: 'ar' | 'en'
  warpEnds: number
  weftPicks: number
}

const STRUCTURE_WORDS: { id: string; ar: string[]; en: string[] }[] = [
  { id: 'plain', ar: ['سادة', 'ساده', 'بسيط', 'تابي'], en: ['plain', 'tabby', 'plain weave'] },
  { id: 'twill', ar: ['مبرد', 'تويل', 'مبارد'], en: ['twill'] },
  { id: 'steepTwill', ar: ['مبرد قائم', 'مبرد حاد', 'ستيب تويل'], en: ['steep twill', 'steep'] },
  { id: 'recliningTwill', ar: ['مبرد منفرج', 'مبرد نائم'], en: ['reclining twill', 'reclining'] },
  { id: 'herringbone', ar: ['عظم السمكة', 'هيرنجبون', 'عظمة السمكة'], en: ['herringbone'] },
  { id: 'chevron', ar: ['شيفرون', 'متعرج', 'زجزاج'], en: ['chevron', 'zigzag'] },
  { id: 'diamond', ar: ['معيني', 'معينات', 'دايموند'], en: ['diamond'] },
  { id: 'brokenTwill', ar: ['مبرد مكسور', 'بروكن تويل'], en: ['broken twill'] },
  { id: 'satin', ar: ['أطلس', 'اطلس'], en: ['satin'] },
  { id: 'sateen', ar: ['ساتان'], en: ['sateen'] },
  { id: 'honeycomb', ar: ['قرص العسل', 'خلية', 'عسل', 'هوني كومب'], en: ['honeycomb'] },
  { id: 'waffle', ar: ['وافل'], en: ['waffle'] },
  { id: 'huckaback', ar: ['هاكاباك', 'هاك'], en: ['huckaback', 'huck'] },
  { id: 'mockLeno', ar: ['شاش كاذب', 'لينو', 'موك لينو'], en: ['mock leno', 'leno'] },
  { id: 'crepe', ar: ['كريب'], en: ['crepe', 'crape'] },
  { id: 'bedfordCord', ar: ['بيدفورد', 'كورد بيدفورد', 'بيدفورد كورد'], en: ['bedford', 'bedford cord'] },
  { id: 'terry', ar: ['تيري', 'منشفة', 'بشكير', 'فوطة', 'وبريات'], en: ['terry', 'towel', 'loop pile'] },
  { id: 'corduroy', ar: ['كوردوروي', 'قطيفة مضلعة'], en: ['corduroy'] },
  { id: 'velvet', ar: ['قطيفة', 'مخمل'], en: ['velvet'] },
  { id: 'basket', ar: ['سلة', 'هوبساك', 'سله', 'باسكت'], en: ['basket', 'hopsack', 'matt'] },
  { id: 'warpRib', ar: ['تضليع سداء', 'ريب سداء'], en: ['warp rib'] },
  { id: 'weftRib', ar: ['تضليع لحمة', 'ريب لحمة'], en: ['weft rib'] },
  { id: 'doubleCloth', ar: ['مزدوج', 'طبقتين', 'قماش دبل'], en: ['double cloth', 'double weave'] },
  { id: 'tripleCloth', ar: ['ثلاثي', 'ثلاث طبقات'], en: ['triple cloth'] },
]

const COLOR_WORDS: { hex: string; ar: string[]; en: string[] }[] = [
  { hex: '#16202D', ar: ['كحلي', 'نيلي غامق', 'كحلى'], en: ['navy', 'dark navy', 'dark blue'] },
  { hex: '#1F3A5F', ar: ['أزرق', 'ازرق', 'نيلي'], en: ['blue', 'indigo'] },
  { hex: '#7A1F27', ar: ['أحمر', 'احمر', 'نبيتي', 'عنابي'], en: ['red', 'burgundy', 'oxblood', 'maroon'] },
  { hex: '#2C4A3B', ar: ['أخضر', 'اخضر', 'زيتي'], en: ['green', 'forest', 'olive'] },
  { hex: '#B98A2E', ar: ['أصفر', 'اصفر', 'خردلي', 'مسطردة'], en: ['yellow', 'mustard', 'gold'] },
  { hex: '#33383D', ar: ['أسود', 'اسود', 'فحمي'], en: ['black', 'charcoal'] },
  { hex: '#F5F2E9', ar: ['أبيض', 'ابيض', 'كريمي', 'سكري', 'اوف وايت'], en: ['white', 'cream', 'ecru', 'off-white'] },
  { hex: '#A85438', ar: ['بني', 'طيني', 'برتقالي', 'طوبي'], en: ['brown', 'terracotta', 'orange', 'rust'] },
  { hex: '#7E22CE', ar: ['بنفسجي', 'موف', 'أرجواني'], en: ['purple', 'violet'] },
  { hex: '#BE185D', ar: ['وردي', 'زهري', 'بمبي'], en: ['pink', 'rose'] },
  { hex: '#0F766E', ar: ['تركواز', 'فيروزي'], en: ['teal', 'turquoise'] },
  { hex: '#B9B2A6', ar: ['رمادي', 'رمادي فاتح', 'رصاصي'], en: ['grey', 'gray', 'greige', 'silver'] },
]

const COLORWAYS = [
  { id: 'ecru', ar: ['إيكرو', 'طبيعي', 'خام'], en: ['ecru', 'natural'] },
  { id: 'indigo', ar: ['نيلي', 'إنديجو', 'جينز'], en: ['indigo', 'denim'] },
  { id: 'oxblood', ar: ['نبيتي', 'أوكسبلود'], en: ['oxblood'] },
  { id: 'forest', ar: ['غابة', 'أخضر غامق'], en: ['forest'] },
  { id: 'charcoal', ar: ['فحمي', 'شاركول'], en: ['charcoal'] },
  { id: 'terracotta', ar: ['طيني', 'تيراكوتا'], en: ['terracotta'] },
  { id: 'navy', ar: ['كحلي'], en: ['navy'] },
  { id: 'mustard', ar: ['خردلي', 'مسطردة'], en: ['mustard'] },
]

function parseNumbers(text: string): number[] {
  return (text.match(/\d+/g) ?? []).map((n) => Number.parseInt(n, 10)).filter((n) => n > 0)
}

function matches(text: string, words: string[]): boolean {
  return words.some((word) => {
    if (/^[a-z0-9 ']+$/i.test(word)) {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’]?")
      return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text)
    }
    return text.includes(word)
  })
}

/**
 * Expert conversational assistant for Textile CAD Studio.
 * Understands textile concepts, conversational greetings, product requests, and multi-action studio commands.
 */
export function localAssistant(text: string, ctx: AssistantContext): AssistantReply {
  const raw = text.trim()
  const t = raw.toLowerCase()
  const hasArabic = /[\u0600-\u06FF]/.test(raw)
  const hasLatin = /[A-Za-z]/.test(raw)
  const ar = hasArabic ? true : hasLatin ? false : ctx.locale === 'ar'
  const actions: AssistantAction[] = []

  if (!raw) {
    return {
      reply: ar
        ? 'أهلاً بك يا باشمهندس! أنا مساعد النسيج والذكاء الاصطناعي في الاستوديو. جاهز لمساعدتك في إنشاء التراكيب النسجية، تلوين الخيوط، مخططات اللوح، أو إجراء الحسابات الفنية.'
        : 'Welcome! I am your textile engineering AI assistant. Ready to help you construct weaves, set colorways, build loom drafts, or perform technical calculations.',
      actions: [],
    }
  }

  // 1. Natural Greetings & Introductions
  const isGreeting =
    /^(hi|hello|hey|greetings|welcome|who are you|what can you do|how are you|test)[\s!؟?.]*$/i.test(t) ||
    /^(ازيك|عامل ايه|سلام|سلام عليكم|السلام عليكم|أهلا|اهلا|مرحبا|صباح الخير|مساء الخير|مين انت|انت مين|يا باشمهندس|باشمهندس|بتعمل ايه|عرفني بيك|هلا)[\s!؟?.]*$/i.test(t)

  if (isGreeting) {
    return {
      reply: ar
        ? `أهلاً بك يا باشمهندس! 👋 أنا مساعد النسيج والذكاء الاصطناعي في Textile CAD Studio.\n\nأقدر أساعدك في:\n• **تصميم التراكيب النسجية:** سادة، مبرد، أطلس، هوبساك، قرص العسل، وافل، جينز، جبردين...\n• **تنسيق الألوان:** تلوين السداء واللحمة أو تطبيق توليفات لونية كاملة.\n• **مخططات النول (Loom Drafting):** حساب عدد الدرأ، خطة التسنين (Drafting)، وربط الدواسات (Tie-up / Peg plan).\n• **الحسابات الفنية:** حساب الكثافة، وزن المتر المربع (GSM)، الاستهلاك وتكلفة التشغيل.\n• **تحليل عينات القماش:** فحص صور العينات وتوليد تركيبها التكراري تلقائياً.\n\nاطلب مني مباشرة، مثلاً: «اعمل مبرد 2/2 كحلي»، «اعملي قماش جينز»، أو «احسب وزن القماش»!`
        : `Hello! 👋 I am your textile engineering AI assistant in Textile CAD Studio.\n\nI can assist you with:\n• **Weave Structures:** Plain, Twill, Satin, Basket/Hopsack, Honeycomb, Waffle, Denim, Gabardine...\n• **Colorways & Thread Coloring:** Custom warp and weft yarns, palette dyes, and stripe patterns.\n• **Industrial Loom Drafting:** Minimum shaft factoring, threading plans, tie-up, and peg plans.\n• **Technical Calculations:** Fabric density, GSM weight, yarn consumption, and production ERP costing.\n• **Fabric Sample Vision Analysis:** Uploading fabric photos to extract weave repeats and yarn colors.\n\nTry commanding me: "Apply a 2/2 twill with navy warp", "Make denim fabric", or "Calculate fabric weight"!`,
      actions: [],
    }
  }

  // 2. Textile Technical Questions & Knowledge Inquiries

  // 2.1 Difference between Twill and Satin
  if (
    (matches(t, ['فرق', 'الفرق', 'difference', 'vs']) &&
      matches(t, ['مبرد', 'تويل', 'twill']) &&
      matches(t, ['ساتان', 'أطلس', 'اطلس', 'satin', 'sateen'])) ||
    t.includes('الفرق بين المبرد والساتان') ||
    t.includes('الفرق بين المبرد والاطلس')
  ) {
    return {
      reply: ar
        ? `المقارنة الهندسية بين المبرد والأطلس:\n\n1. **المبرد (Twill Weave):**\n• يتميز بظهور خطوط مائلة بارزة (Diagonal Wales) بزاوية 45° أو 63.4° نتيجة تقدم نقاط التقاطع بمقدار خيط واحد في كل حدفة.\n• يعطي متانة عالية جداً ومقاومة ممتازة للتآكل والتمزق مع انسيابية جيدة (مثل أقمشة الجينز الدنيم والجبردين والكابردين).\n\n2. **الأطلس / الساتان (Satin / Sateen Weave):**\n• تتوزع فيه نقاط التقاطع بانتظام وتباعد وفق خطوة عددية محددة (Counter/Step) بحيث لا تتلامس نقاط التقاطع إطلاقاً.\n• يمنح سطحاً أملساً شديد النعومة واللمعان وانسدالاً فائقاً (Drape) بسبب طفو الخيوط الطويل (مثل بطانات البدلات وأقمشة السواريه والحرائر).`
        : `Textile Engineering Comparison — Twill vs. Satin:\n\n1. **Twill Weave:**\n• Characterized by distinct diagonal ridges (wales) running at 45° or 63.4°, formed by stepped interlacing points.\n• Delivers high tensile and tear strength, excellent abrasion resistance, and good drape (e.g. Denim, Gabardine, Chino).\n\n2. **Satin / Sateen Weave:**\n• Interlacing points are widely dispersed using a calculated step/counter, ensuring no two binding points touch.\n• Yields a lustrous, ultra-smooth face with long uninterrupted yarn floats and elegant drape (e.g. Luxury linings, bridal satin, dresswear).`,
      actions: [],
    }
  }

  // 2.2 GSM & Fabric Weight Formula
  if (matches(t, ['gsm', 'وزن القماش', 'وزن المتر', 'حساب الوزن', 'وزن المتر المربع', 'fabric weight'])) {
    actions.push({ type: 'navigate', to: 'calculations' })
    return {
      reply: ar
        ? `معادلة حساب وزن المتر المربع (GSM):\n$$\\text{GSM} = \\text{وزن السداء} + \\text{وزن اللحمة}$$\n• **وزن السداء** = $\\frac{\\text{عدد خيوط السداء/سم} \\times 100 \\times (1 + \\text{نسبة التشريب}\\%) \\times \\text{تكس}}{1000}$\n• **وزن اللحمة** = $\\frac{\\text{عدد حدفات اللحمة/سم} \\times 100 \\times (1 + \\text{نسبة التشريب}\\%) \\times \\text{تكس}}{1000}$\n\nفتحت لك صفحة الحسابات الفنية لحساب العينة بدقة شاملة انكماش الغسيل وتكاليف التشغيل!`
        : `Fabric Weight (GSM) Calculation Formula:\n$$\\text{GSM} = W_{\\text{warp}} + W_{\\text{weft}}$$\n• $W_{\\text{warp}} = \\frac{\\text{Ends/cm} \\times 100 \\times (1 + \\text{Crimp}\\%) \\times \\text{Tex}}{1000}$\n• $W_{\\text{weft}} = \\frac{\\text{Picks/cm} \\times 100 \\times (1 + \\text{Crimp}\\%) \\times \\text{Tex}}{1000}$\n\nI have navigated to the Calculations panel where you can compute the exact sample weight and yarn order breakdowns!`,
      actions,
    }
  }

  // 2.3 Yarn Count Systems & Conversions (Ne, Nm, Tex, Denier)
  if (
    matches(t, ['نمر', 'نمرة', 'yarn count', 'ne', 'nm', 'tex', 'denier', 'تكس', 'دنير']) &&
    matches(t, ['تحويل', 'معادلة', 'شرح', 'ازاي', 'convert', 'formula', 'system', 'explain'])
  ) {
    return {
      reply: ar
        ? `أنظمة نمر الغزل وقوانين التحويل:\n\n• **النظام الإنجليزي (Ne):** غير مباشر (الرقم الأكبر يعني خيطاً أرفع). عدد الشلل بطول 840 ياردة في رطل واحد.\n• **النظام المتري (Nm):** غير مباشر. عدد الكيلومترات في كيلوجرام واحد ($Nm = 1.693 \\times Ne$).\n• **التكس (Tex):** النظام المباشر القياسي العالمي ISO. وزن 1000 متر من الخيط بالجرام ($Tex = \\frac{590.5}{Ne} = \\frac{1000}{Nm}$).\n• **الدنير (Denier):** مباشر (للحرير والألياف المستمرة). وزن 9000 متر بالجرام ($Denier = 9 \\times Tex$).`
        : `Yarn Count Systems & Conversion Formulas:\n\n• **English Cotton (Ne):** Indirect system (higher count = finer yarn). Number of 840-yard hanks per pound.\n• **Metric Count (Nm):** Indirect system. Kilometers per kilogram ($Nm = 1.693 \\times Ne$).\n• **Tex:** Universal direct metric system (ISO). Grams per 1,000 meters ($Tex = 590.5 / Ne = 1000 / Nm$).\n• **Denier:** Direct system for filaments. Grams per 9,000 meters ($Denier = 9 \\times Tex = 5315 / Ne$).`,
      actions: [],
    }
  }

  // 2.4 Loom Shafts, Dobby vs Jacquard
  if (matches(t, ['درأ', 'درأة', 'درأه', 'shaft', 'shafts', 'dobby', 'jacquard', 'دوبي', 'جاكارد'])) {
    actions.push({ type: 'openDraft' })
    return {
      reply: ar
        ? `إمكانية النسيج ونظام اللوح (Loom Feasibility):\n• **أنوال الدوبي (Dobby Looms):** تتحكم في الدرأ حتى 24 إلى 28 درأة كحد أقصى، وهي مثالية للتراكيب الهندسية المنتظمة.\n• **أنوال الجاكارد (Jacquard Looms):** تحكّم فردي في كل خيط سداء عبر خيوط الحرير والهارنس (مئات أو آلاف الخيوط المستقلة)، وهي مخصصة للتصميمات الزخرفية والصور والرسومات الحرة.\n\nفتحت لك مخطط النسج أسفل الشاشة لعرض عدد الدرأ المطلوب وخطة التسنين!`
        : `Loom Capacity & Drafting Feasibility:\n• **Dobby Looms:** Control heald shafts up to 24-28 shafts max, suitable for geometric and repetitive repeat weaves.\n• **Jacquard Looms:** Provide individual thread control for each warp end (hundreds/thousands of hooks), used for damasks, pictorial jacquards, and freeform patterns.\n\nOpened the Industrial Loom Drafting panel beneath the canvas to inspect minimum shafts and peg plan!`,
      actions,
    }
  }

  // 3. Iconic Fabric Product Recipes

  // 3.1 Denim / Jeans
  if (matches(t, ['جينز', 'دنيم', 'denim', 'jeans'])) {
    actions.push({ type: 'applyStructure', id: 'twill', options: { up: 3, down: 1, direction: 'Z' } })
    actions.push({ type: 'setColors', warp: '#1F3A5F', weft: '#F5F2E9' })
    return {
      reply: ar
        ? 'تم تطبيق قماش الجينز الأصلي (Classic Denim): تركيب مبرد سداء 3/1 Z مع خيوط سداء مصبوغة نيلي (Indigo #1F3A5F) ولحمة بيضاء طبيعية (#F5F2E9).'
        : 'Applied authentic Denim recipe: 3/1 Z warp-faced twill with indigo warp (#1F3A5F) and natural ecru weft (#F5F2E9).',
      actions,
    }
  }

  // 3.2 Gabardine
  if (matches(t, ['جبردين', 'جابردين', 'gabardine'])) {
    actions.push({ type: 'applyStructure', id: 'steepTwill', options: { up: 2, down: 2, direction: 'Z' } })
    actions.push({ type: 'setColors', warp: '#16202D', weft: '#16202D' })
    return {
      reply: ar
        ? 'تم تطبيق قماش الجبردين (Gabardine): مبرد قائم بزاوية 63.4° (Steep Twill 2/2 Z) عالي الكثافة والمتانة المخصص للبدلات والمعاطف.'
        : 'Applied Gabardine recipe: 63.4° steep twill (2/2 Z) with high density for suitings and trench coats.',
      actions,
    }
  }

  // 3.3 Oxford Shirt
  if (matches(t, ['أكسفورد', 'اكسفورد', 'oxford', 'قميص', 'قمصان'])) {
    actions.push({ type: 'applyStructure', id: 'basket', options: { size: 2 } })
    actions.push({ type: 'setColors', warp: '#1F3A5F', weft: '#F5F2E9' })
    return {
      reply: ar
        ? 'تم تطبيق قماش أكسفورد الكلاسيكي للقمصان (Oxford Shirting): تركيب سلة 2/2 (Hopsack) بسداء أزرق ولحمة بيضاء ناعمة.'
        : 'Applied classic Oxford shirting: 2/2 basket weave with dyed blue warp and crisp white weft.',
      actions,
    }
  }

  // 3.4 Houndstooth
  if (matches(t, ['سن الفيل', 'هاوندز توث', 'هاوندستوث', 'houndstooth'])) {
    actions.push({ type: 'applyStructure', id: 'twill', options: { up: 2, down: 2, direction: 'Z' } })
    actions.push({ type: 'colorway', id: 'charcoal' })
    return {
      reply: ar
        ? 'تم تطبيق تركيب سن الفيل (Houndstooth): مبرد 2/2 Z مع ترتيب لوني متعاقب 4 غامق و 4 فاتح في السداء واللحمة.'
        : 'Applied Houndstooth pattern: 2/2 Z twill with alternating 4 dark / 4 light colorway arrangement.',
      actions,
    }
  }

  // 3.5 Towel / Terry
  if (matches(t, ['منشفة', 'بشكير', 'فوطة', 'فوط', 'تيري', 'terry', 'towel'])) {
    actions.push({ type: 'applyStructure', id: 'terry', options: { size: 6 } })
    return {
      reply: ar
        ? 'تم تطبيق تركيب الأقمشة الوبرية (Terry Weave) المخصص لإنتاج المناشف والبشاكير ذات الامتصاصية العالية للماء.'
        : 'Applied Terry pile weave designed for high-absorbency towels and bathrobes.',
      actions,
    }
  }

  // 3.6 Chambray
  if (matches(t, ['شامبراي', 'شمبراي', 'chambray'])) {
    actions.push({ type: 'applyStructure', id: 'plain' })
    actions.push({ type: 'setColors', warp: '#1F3A5F', weft: '#F5F2E9' })
    return {
      reply: ar
        ? 'تم تطبيق قماش الشامبراي (Chambray): تركيب سادة 1/1 بسداء نيلي كحلي ولحمة بيضاء نقية.'
        : 'Applied Chambray fabric: 1/1 plain weave with indigo warp and ecru weft.',
      actions,
    }
  }

  // 4. Combined Multi-Intent Action Parsing (Structures + Colors + Sizing + Navigation)

  // 4.1 Check Structure
  const structure = STRUCTURE_WORDS.find((s) => matches(t, s.ar) || matches(t, s.en))
  if (structure) {
    const def = structureById(structure.id)
    const numbers = parseNumbers(t)
    const options: StructureOptions = {}
    if (structure.id === 'twill') {
      if (numbers.length >= 2) {
        options.up = numbers[0]
        options.down = numbers[1]
      } else if (numbers.length === 1) {
        options.up = numbers[0]
        options.down = numbers[0]
      }
      if (/(^|[^a-z0-9])s([^a-z0-9]|$)/i.test(t)) options.direction = 'S'
      else options.direction = 'Z'
    }
    if (def?.family === 'satin' && numbers.length > 0) options.size = numbers[0]
    if (def?.family === 'cell' && numbers.length > 0) options.size = numbers[0]

    actions.push({ type: 'applyStructure', id: structure.id, options })
  }

  // 4.2 Check Colourway
  const cw = COLORWAYS.find((c) => matches(t, c.ar) || matches(t, c.en))
  if (cw && (t.includes('لون') || t.includes('colourway') || t.includes('colorway') || t.includes('تلوين') || t.includes('توليفة'))) {
    actions.push({ type: 'colorway', id: cw.id })
  }

  // 4.3 Check Specific Warp / Weft Colors
  const isWeftMentioned = matches(t, ['لحمة', 'weft', 'filling', 'pick', 'picks', 'حدفة'])
  const isWarpMentioned = matches(t, ['سداء', 'warp', 'end', 'ends', 'تسدية'])

  const foundColors: { hex: string; word: string }[] = []
  for (const c of COLOR_WORDS) {
    if (matches(t, c.ar) || matches(t, c.en)) {
      foundColors.push({ hex: c.hex, word: c.ar[0] })
    }
  }

  if (foundColors.length >= 2) {
    // If two colors mentioned (e.g. "كحلي في ابيض" / "navy and white")
    actions.push({ type: 'setColors', warp: foundColors[0].hex, weft: foundColors[1].hex })
  } else if (foundColors.length === 1) {
    const col = foundColors[0].hex
    if (isWeftMentioned && !isWarpMentioned) {
      actions.push({ type: 'setColors', weft: col })
    } else if (isWarpMentioned && !isWeftMentioned) {
      actions.push({ type: 'setColors', warp: col })
    } else if (t.includes('لون') || t.includes('color') || t.includes('خليه') || t.includes('اجعل')) {
      actions.push({ type: 'setColors', warp: col, weft: col })
    }
  }

  // 4.4 Check Resize
  if (t.includes('مقاس') || t.includes('حجم') || t.includes('size') || t.includes('resize') || t.includes('grid') || t.includes('شبكة') || t.includes('شبكه')) {
    const numbers = parseNumbers(t)
    if (numbers.length >= 2) {
      actions.push({ type: 'resize', warpEnds: numbers[0], weftPicks: numbers[1] })
    }
  }

  // 4.5 Check Draft Plan
  if (matches(t, ['draft', 'درافت', 'تخطيط', 'اللوح', 'دواسات', 'درأ', 'مخطط النسج', 'تسنين'])) {
    actions.push({ type: 'openDraft' })
  }

  // 4.6 Check Clear Canvas
  if (matches(t, ['امسح', 'نظف', 'تفريغ', 'clear', 'reset', 'فضّي'])) {
    actions.push({ type: 'clear' })
  }

  // 4.7 Check Calculations Navigation
  if (matches(t, ['حساب', 'كثافة', 'استهلاك', 'تكلفة', 'calculate', 'density', 'consumption', 'erp', 'تكاليف'])) {
    actions.push({ type: 'navigate', to: 'calculations' })
  }

  // 4.8 Check Yarn Library Navigation
  if (matches(t, ['خيط', 'خيوط', 'yarn', 'مكتبة', 'library'])) {
    actions.push({ type: 'navigate', to: 'library' })
  }

  // If actions were detected, construct a clear and positive engineering confirmation
  if (actions.length > 0) {
    const parts: string[] = []
    for (const a of actions) {
      if (a.type === 'applyStructure') {
        const def = structureById(a.id)
        const name = ar ? def?.nameAr ?? a.id : def?.nameEn ?? a.id
        const detail =
          a.id === 'twill' && (a.options?.up || a.options?.down)
            ? ` ${a.options.up ?? 2}/${a.options.down ?? 2}`
            : ''
        parts.push(ar ? `تطبيق تركيب ${name}${detail}` : `Applied ${name}${detail}`)
      } else if (a.type === 'setColors') {
        parts.push(ar ? 'تحديث ألوان السداء واللحمة' : 'Updated yarn colours')
      } else if (a.type === 'colorway') {
        parts.push(ar ? 'تطبيق التوليفة اللونية' : 'Applied colourway')
      } else if (a.type === 'resize') {
        parts.push(ar ? `ضبط أبعاد الشبكة إلى ${a.warpEnds}×${a.weftPicks}` : `Resized grid to ${a.warpEnds}×${a.weftPicks}`)
      } else if (a.type === 'openDraft') {
        parts.push(ar ? 'فتح مخطط النسج واللوح' : 'Opened loom draft plan')
      } else if (a.type === 'clear') {
        parts.push(ar ? 'تفريغ شبكة التصميم' : 'Cleared studio canvas')
      } else if (a.type === 'navigate') {
        parts.push(ar ? `الانتقال إلى صفحة ${a.to}` : `Navigated to ${a.to}`)
      }
    }

    const reply = ar
      ? `تم بنجاح: ${parts.join('، ')}.\n\nيمكنك طلب أي تعديل إضافي أو فحص مخطط الدرأ والحسابات الفنية.`
      : `Successfully executed: ${parts.join(', ')}.\n\nYou can request further adjustments, examine shaft drafting, or check calculations.`

    return { reply, actions }
  }

  // Fallback for general textile assistant conversation
  const names = STRUCTURES.slice(0, 6)
    .map((s) => (ar ? s.nameAr : s.nameEn))
    .join(ar ? '، ' : ', ')

  return {
    reply: ar
      ? `أهلاً بك يا باشمهندس. أنا مهندس النسيج ومساعدك الذكي في الاستوديو.\n\nأستطيع تنفيذ أي مهمة نسجية مباشرة:\n• تطبيق التراكيب (${names}…)\n• تصميم أقمشة مشهورة: جينز دنيم، جبردين، أكسفورد، أو أقمشة وبرية\n• ضبط وتلوين خيوط السداء واللحمة، وتغيير مقاس الشبكة\n• فتح مخطط النول وحسابات الكثافة والأوزان (GSM)\n\nجرّب كتابة طلبك مباشرة: «اعمل مبرد 2/2 كحلي»، «اعملي جينز»، أو «احسب وزن القماش».`
      : `Welcome. I am your textile engineering AI assistant.\n\nI can directly execute any weaving task:\n• Apply weave structures (${names}…)\n• Construct famous fabrics: Denim, Gabardine, Oxford shirting, or Terry towels\n• Color warp and weft yarns, or resize the grid\n• Open loom shaft drafts and compute fabric GSM and costs\n\nTry commanding me: "Apply a 2/2 twill in navy", "Make denim", or "Calculate fabric weight".`,
    actions: [],
  }
}

/** Pages the assistant is allowed to open. */
const PAGES = new Set(['dashboard', 'designs', 'studio', 'library', 'calculations', 'settings'])

/** Validates a model-proposed action list before the editor sees it. */
export function sanitizeActions(input: unknown): AssistantAction[] {
  if (!Array.isArray(input)) return []
  const out: AssistantAction[] = []
  for (const item of input.slice(0, 8)) {
    if (!item || typeof item !== 'object') continue
    const a = item as Record<string, unknown>
    const type = a.type
    if (type === 'applyStructure' && typeof a.id === 'string' && structureById(a.id)) {
      out.push({
        type,
        id: a.id,
        options: (a.options && typeof a.options === 'object' ? a.options : {}) as StructureOptions,
      })
    } else if (
      type === 'colorway' &&
      typeof a.id === 'string' &&
      COLORWAY_CATALOG.some((c) => c.id === a.id)
    ) {
      out.push({ type, id: a.id })
    } else if (type === 'setColors') {
      const warp = typeof a.warp === 'string' && /^#[0-9a-f]{6}$/i.test(a.warp) ? a.warp : undefined
      const weft = typeof a.weft === 'string' && /^#[0-9a-f]{6}$/i.test(a.weft) ? a.weft : undefined
      if (warp || weft) out.push({ type, warp, weft })
    } else if (type === 'resize' && typeof a.warpEnds === 'number' && typeof a.weftPicks === 'number') {
      out.push({
        type,
        warpEnds: Math.max(2, Math.min(200, Math.round(a.warpEnds))),
        weftPicks: Math.max(2, Math.min(200, Math.round(a.weftPicks))),
      })
    } else if (type === 'clear' || type === 'openDraft') {
      out.push({ type })
    } else if (type === 'navigate' && typeof a.to === 'string' && PAGES.has(a.to)) {
      out.push({ type, to: a.to })
    }
  }
  return out
}
