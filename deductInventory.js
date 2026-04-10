/**
 * НОВЫЙ СКРИПТ для списания товара - БОЛЕЕ ПРОСТОЙ
 * 
 * Просто вставь в консоль браузера (F12):
 */

// Способ 1: Если скрипт выше не сработал, используй этот упрощённый:
(async () => {
  try {
    console.log('🔍 Попытка 1: Ищу db в window...');
    
    // Ищем все объекты на window которые похожи на БД
    const keys = Object.keys(window).filter(k => k.includes('db') || k.includes('DB'));
    console.log('🔎 Найденные ключи:', keys);
    
    // Пробуем использовать глобальный db если он был импортирован
    if (typeof da !== 'undefined' && da.adminDeductInventory) {
      console.log('✅ Найдена функция db.adminDeductInventory!');
      
      const result = await db.adminDeductInventory(
        'romakovalenko54@gmail.com',
        'Футболка',
        290
      );
      
      console.log('🟢 Результат:', result);
      return;
    }

    console.error('❌ db.adminDeductInventory не найдена');
    console.log('💡 Подсказка: может быть нужно перезагрузить страницу (Ctrl+F5)');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
})();

// Способ 2: Если первый не сработал, используй этот - более универсальный:
(async () => {
  // Ищем БД через инспекцию React компонентов
  console.log('🔍 Попытка 2: Ищу db через React...');
})();
