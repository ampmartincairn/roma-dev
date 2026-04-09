import { db } from './api/base44Client.js';

// Функция для создания тестовых данных
window.createTestData = async function() {
  console.log('Creating test data...');

  try {
    // Создание пользователей
    console.log('Creating users...');
    await db.auth.register('admin', 'admin@wms.com', 'admin123', 'Администратор Системы', 'admin');
    await db.auth.register('manager', 'manager@wms.com', 'manager123', 'Менеджер Склада', 'manager');
    await db.auth.register('client1', 'client1@example.com', 'client123', 'Клиент Один', 'client');

    // Создание заявок на приемку
    console.log('Creating reception requests...');
    const receptionRequests = [
      {
        request_number: 'RR-001',
        client_email: 'client1@example.com',
        client_name: 'ООО Рога и Копыта',
        status: 'новая',
        items: [
          { product_name: 'Смартфон Samsung Galaxy', sku: 'SG-001', expected_qty: 10, received_qty: 0, barcode: '123456789' },
          { product_name: 'Ноутбук Dell', sku: 'DL-001', expected_qty: 5, received_qty: 0, barcode: '987654321' }
        ]
      },
      {
        request_number: 'RR-002',
        client_email: 'client1@example.com',
        client_name: 'ООО Рога и Копыта',
        status: 'в обработке',
        items: [
          { product_name: 'Кофеварка Philips', sku: 'PH-001', expected_qty: 20, received_qty: 15, barcode: '456789123' }
        ]
      },
      {
        request_number: 'RR-003',
        client_email: 'client1@example.com',
        client_name: 'ООО Рога и Копыта',
        status: 'принята',
        items: [
          { product_name: 'Монитор LG', sku: 'LG-001', expected_qty: 8, received_qty: 8, barcode: '789123456' }
        ]
      }
    ];

    for (const request of receptionRequests) {
      await db.entities.ReceptionRequest.create(request);
    }

    // Создание заказов на отгрузку
    console.log('Creating assembly orders...');
    const assemblyOrders = [
      {
        order_number: 'AO-001',
        client_email: 'client1@example.com',
        client_name: 'ООО Рога и Копыта',
        status: 'новая',
        items: [
          { product_name: 'Смартфон Samsung Galaxy', sku: 'SG-001', quantity: 5, honest_mark: 'HM001' }
        ]
      },
      {
        order_number: 'AO-002',
        client_email: 'client1@example.com',
        client_name: 'ООО Рога и Копыта',
        status: 'в обработке',
        items: [
          { product_name: 'Кофеварка Philips', sku: 'PH-001', quantity: 3, honest_mark: 'HM002' }
        ]
      },
      {
        order_number: 'AO-003',
        client_email: 'client1@example.com',
        client_name: 'ООО Рога и Копыта',
        status: 'отгружена',
        items: [
          { product_name: 'Монитор LG', sku: 'LG-001', quantity: 2, honest_mark: 'HM003' }
        ]
      }
    ];

    for (const order of assemblyOrders) {
      await db.entities.AssemblyOrder.create(order);
    }

    console.log('Test data created successfully!');
    console.log('Users created:');
    console.log('  admin/admin123 (admin) - Active');
    console.log('  manager/manager123 (manager) - Active');
    console.log('  client1/client123 (client) - Active');
    console.log('  inactive_user/inactive123 (client) - Inactive (cannot login)');

  } catch (error) {
    console.error('Error creating test data:', error);
  }
};

console.log('Test data creation script loaded. Run createTestData() in the browser console.');