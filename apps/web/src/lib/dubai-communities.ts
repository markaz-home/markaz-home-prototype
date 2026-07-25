/**
 * Curated Dubai community names for the hero search typeahead.
 *
 * INTERIM SOURCE. This is a hand-maintained list of the residential communities
 * buyers actually type, not an authoritative register. The intended source is
 * the Dubai Land Department area/community register published on Dubai Pulse,
 * imported into Postgres once and queried locally (see
 * docs/integrations/bayutapi-home-poc.md — the listing provider exposes no
 * locations endpoint, so it cannot supply this).
 *
 * Live inventory alone is a poor suggestion source: a listing's `community` is
 * often a tower or project name ("Auresta Tower"), so a visitor typing the
 * district they have in mind ("meadows", "downtown") would get nothing. These
 * names are merged with the communities that actually appear on listings.
 *
 * Suggesting an area does not promise inventory in it — the browse page has an
 * intentional empty state, and free text is always allowed. Arabic names are
 * draft and unreviewed, like the rest of the Arabic catalogue.
 */
export interface CommunityName {
  en: string;
  ar: string;
}

export const DUBAI_COMMUNITIES: readonly CommunityName[] = [
  // Central / waterfront
  { en: 'Downtown Dubai', ar: 'وسط مدينة دبي' },
  { en: 'Business Bay', ar: 'الخليج التجاري' },
  { en: 'DIFC', ar: 'مركز دبي المالي العالمي' },
  { en: 'City Walk', ar: 'سيتي ووك' },
  { en: 'Al Wasl', ar: 'الوصل' },
  { en: 'Za’abeel', ar: 'زعبيل' },
  { en: 'Dubai Marina', ar: 'دبي مارينا' },
  { en: 'Jumeirah Beach Residence', ar: 'جميرا بيتش ريزيدنس' },
  { en: 'Bluewaters Island', ar: 'جزيرة بلوواترز' },
  { en: 'Dubai Harbour', ar: 'ميناء دبي' },
  { en: 'Emaar Beachfront', ar: 'إعمار بيتشفرونت' },
  { en: 'Palm Jumeirah', ar: 'نخلة جميرا' },
  { en: 'Palm Jebel Ali', ar: 'نخلة جبل علي' },
  { en: 'Jumeirah Bay Island', ar: 'جزيرة جميرا باي' },
  { en: 'Pearl Jumeirah', ar: 'لؤلؤة جميرا' },
  { en: 'La Mer', ar: 'لا مير' },
  { en: 'Dubai Creek Harbour', ar: 'مرسى خور دبي' },
  { en: 'Dubai Islands', ar: 'جزر دبي' },
  { en: 'Port Rashid', ar: 'ميناء راشد' },
  { en: 'Al Jaddaf', ar: 'الجدّاف' },
  { en: 'Culture Village', ar: 'قرية الثقافة' },
  { en: 'Sobha Hartland', ar: 'صوبها هارتلاند' },
  { en: 'Mohammed Bin Rashid City', ar: 'مدينة محمد بن راشد' },
  { en: 'Meydan', ar: 'ميدان' },
  { en: 'Nad Al Sheba', ar: 'ند الشبا' },

  // Emirates Living and the western villa belt
  { en: 'The Meadows', ar: 'المروج' },
  { en: 'The Lakes', ar: 'البحيرات' },
  { en: 'The Springs', ar: 'الينابيع' },
  { en: 'The Views', ar: 'ذا فيوز' },
  { en: 'The Greens', ar: 'الروضة' },
  { en: 'Emirates Hills', ar: 'تلال الإمارات' },
  { en: 'Jumeirah Golf Estates', ar: 'جميرا جولف إستيتس' },
  { en: 'Jumeirah Park', ar: 'حدائق جميرا' },
  { en: 'Jumeirah Islands', ar: 'جزر جميرا' },
  { en: 'Jumeirah Heights', ar: 'مرتفعات جميرا' },
  { en: 'Al Barsha', ar: 'البرشاء' },
  { en: 'Barsha Heights', ar: 'مرتفعات البرشاء' },
  { en: 'Al Sufouh', ar: 'الصفوح' },
  { en: 'Umm Suqeim', ar: 'أم سقيم' },
  { en: 'Jumeirah', ar: 'جميرا' },
  { en: 'Al Safa', ar: 'الصفا' },
  { en: 'Al Quoz', ar: 'القوز' },

  // New Dubai / apartment districts
  { en: 'Jumeirah Lake Towers', ar: 'أبراج بحيرات جميرا' },
  { en: 'Jumeirah Village Circle', ar: 'قرية جميرا سركل' },
  { en: 'Jumeirah Village Triangle', ar: 'مثلث قرية جميرا' },
  { en: 'Al Furjan', ar: 'الفرجان' },
  { en: 'Discovery Gardens', ar: 'ديسكفري جاردنز' },
  { en: 'The Gardens', ar: 'الحدائق' },
  { en: 'Dubai Production City', ar: 'مدينة دبي للإنتاج' },
  { en: 'Dubai Studio City', ar: 'مدينة دبي للاستوديوهات' },
  { en: 'Dubai Sports City', ar: 'مدينة دبي الرياضية' },
  { en: 'Motor City', ar: 'موتور سيتي' },
  { en: 'Arjan', ar: 'أرجان' },
  { en: 'Dubai Science Park', ar: 'مجمع دبي للعلوم' },
  { en: 'Dubai Silicon Oasis', ar: 'واحة دبي للسيليكون' },
  { en: 'Dubai Investment Park', ar: 'مجمع دبي للاستثمار' },
  { en: 'Green Community', ar: 'المجتمع الأخضر' },
  { en: 'Dubai South', ar: 'دبي الجنوب' },
  { en: 'Expo City', ar: 'مدينة إكسبو' },
  { en: 'Jebel Ali Village', ar: 'قرية جبل علي' },

  // Master-planned villa communities
  { en: 'Dubai Hills Estate', ar: 'دبي هيلز استيت' },
  { en: 'Arabian Ranches', ar: 'المرابع العربية' },
  { en: 'Arabian Ranches 2', ar: 'المرابع العربية 2' },
  { en: 'Arabian Ranches 3', ar: 'المرابع العربية 3' },
  { en: 'Damac Hills', ar: 'داماك هيلز' },
  { en: 'Damac Hills 2', ar: 'داماك هيلز 2' },
  { en: 'Damac Lagoons', ar: 'داماك لاجونز' },
  { en: 'Tilal Al Ghaf', ar: 'تلال الغاف' },
  { en: 'Town Square', ar: 'تاون سكوير' },
  { en: 'Villanova', ar: 'فيلانوفا' },
  { en: 'The Valley', ar: 'ذا فالي' },
  { en: 'Mudon', ar: 'مدن' },
  { en: 'Remraam', ar: 'رمرام' },
  { en: 'Serena', ar: 'سيرينا' },
  { en: 'Mira', ar: 'ميرا' },
  { en: 'Cherrywoods', ar: 'شيريوودز' },
  { en: 'Dubailand', ar: 'دبي لاند' },
  { en: 'Liwan', ar: 'ليوان' },
  { en: 'Majan', ar: 'ماجان' },

  // Established eastern Dubai
  { en: 'Mirdif', ar: 'مردف' },
  { en: 'Al Warqa', ar: 'الورقاء' },
  { en: 'Al Qusais', ar: 'القصيص' },
  { en: 'Al Nahda', ar: 'النهدة' },
  { en: 'Muhaisnah', ar: 'محيصنة' },
  { en: 'International City', ar: 'المدينة العالمية' },
  { en: 'Dubai Festival City', ar: 'دبي فستيفال سيتي' },
  { en: 'Ras Al Khor', ar: 'رأس الخور' },
  { en: 'Deira', ar: 'ديرة' },
  { en: 'Bur Dubai', ar: 'بر دبي' },
];

/** Community names in the reader's language. */
export function dubaiCommunityNames(locale: string): string[] {
  return DUBAI_COMMUNITIES.map((community) => (locale === 'ar' ? community.ar : community.en));
}
