const fs = require('fs')
const path = require('path')

const root = path.join(process.cwd(), 'frontend', 'src', 'lib', 'locales')

const extra = {
  ar: {
    studio: {
      draftPlan: 'مخطط النسج',
      draftPlanHint:
        'تسنين السداء، ربط الدواسات، خطة الرفع، والنسيج الناتج — نفس عرض مخططات أنوال الدوبي الصناعية.',
      downloadPng: 'تنزيل PNG',
      pegPlan: 'خطة الرفع (بيج بلان)',
      tieUpPlan: 'مخطط ربط الدواسات',
      shafts: 'الأنوال (الرماثات)',
      draftLegend:
        'أعلى يمين: تسنين السداء · أعلى يسار: ربط الدواسات · أسفل يسار: خطة الدواسات · أسفل يمين: النسيج. الصف 0 هو آخر لحمة من الأسفل.',
      exportMatrix: 'مصفوفة النسج (أول 16×16)',
      tabLibrary: 'مكتبة التراكيب',
      tabCompose: 'أقمشة مركبة',
      applyStructure: 'تطبيق التركيب',
      searchStructure: 'ابحث عن تركيب…',
      allFamilies: 'كل العائلات',
      noStructures: 'لا يوجد تركيب مطابق لهذا الفلتر.',
      colorMode: 'الألوان',
      colorKeep: 'الإبقاء على ألوان الخيوط الحالية',
      colorColourway: 'تطبيق توليفة ألوان من المصبغة',
      colorContrast: 'تباين المخطط (غامق / إيكرو)',
      colourway: 'توليفة الألوان',
      tripleCloth: 'نسيج ثلاثي',
      compoundHint:
        'الوجه والظهر يتبادلان في بلوكات، ولحامات الخياطة تربط الطبقات حتى لا تنفصل.',
      effectHoundstooth: 'عظم الكلب (مبرد 2/2)',
      effectHairline: 'خط شعري (سادة 1/1)',
      effectStep: 'تأثير الدرج (سادة 1/1)',
      effectGlenPlaid: 'جلين بلاند / أمير ويلز',
      effectPincheck: 'كاروهات دقيقة',
      effectBirdseye: 'عين الطير المعينية',
      effectAlgorithmic: 'موجات خوارزمية',
    },
    assistant: {
      title: 'مساعد الاستوديو',
      subtitle: 'تراكيب، ألوان، حسابات، وصور عينات',
      offline: 'أوامر بدون اتصال',
      analyse: 'تحليل العينة',
      attach: 'إرفاق صورة عينة',
      placeholder: 'اطلب أو اسأل…',
      send: 'إرسال',
    },
    common: {
      downloaded: 'تم التنزيل',
      remove: 'إزالة',
    },
  },
  en: {
    studio: {
      draftPlan: 'Draft plan',
      draftPlanHint:
        'Threading, tie-up, lift plan and the resulting weave — the same view used by industrial dobby software.',
      downloadPng: 'Download PNG',
      pegPlan: 'Peg plan (lift plan)',
      tieUpPlan: 'Tie-up draft',
      shafts: 'Shafts',
      draftLegend:
        'Top-right: threading · top-left: tie-up · bottom-left: treadling · bottom-right: weave. Row 0 is the bottom pick.',
      exportMatrix: 'Weave matrix (top-left 16×16)',
      tabLibrary: 'Structure library',
      tabCompose: 'Compound cloth',
      applyStructure: 'Apply structure',
      searchStructure: 'Search structures…',
      allFamilies: 'All families',
      noStructures: 'No structure matches this filter.',
      colorMode: 'Colours',
      colorKeep: 'Keep current yarn colours',
      colorColourway: 'Apply a dye-house colourway',
      colorContrast: 'Draft contrast (dark / ecru)',
      colourway: 'Colourway',
      tripleCloth: 'Triple cloth',
      compoundHint:
        'Face and back interchange in blocks; stitching picks bind the layers so the cloth cannot delaminate.',
      effectHoundstooth: 'Houndstooth (2/2 twill)',
      effectHairline: 'Hairline (1/1 plain)',
      effectStep: 'Step effect (1/1 plain)',
      effectGlenPlaid: 'Glen plaid / Prince of Wales',
      effectPincheck: 'Pin check',
      effectBirdseye: 'Birdseye diamond',
      effectAlgorithmic: 'Algorithmic waves',
    },
    assistant: {
      title: 'Studio assistant',
      subtitle: 'Structures, colours, calculations, sample photos',
      offline: 'Offline commands',
      analyse: 'Analyse sample',
      attach: 'Attach sample photo',
      placeholder: 'Ask or command…',
      send: 'Send',
    },
    common: {
      downloaded: 'Downloaded',
      remove: 'Remove',
    },
  },
}

for (const lang of ['ar', 'en']) {
  const file = path.join(root, `${lang}.json`)
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (const section of Object.keys(extra[lang])) {
    data[section] = data[section] || {}
    Object.assign(data[section], extra[lang][section])
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
  console.log(`${lang}: ${Object.keys(data.studio).length} studio keys, ${Object.keys(data.assistant).length} assistant keys`)
}
