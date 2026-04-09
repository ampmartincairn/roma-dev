// Скрипт для создания тестовых данных
// Запустите этот код в консоли браузера после входа в систему

import { db } from './api/base44Client.js';

// Создание тестовых заявок на приемку (входящий поток)
const createTestReceptionRequests = async () => {
  const receptionRequests = [
    {
      request_number: "RR-001",
      client_email: "client1@example.com",
      client_name: "ООО Рога и Копыта",
      status: "новая",
      items: [
        {
          product_name: "Смартфон Samsung Galaxy",
          sku: "SG-001",
          expected_qty: 10,
          received_qty: 0,
          barcode: "123456789"
        },
        {
          product_name: "Ноутбук Dell",
          sku: "DL-001",
          expected_qty: 5,
          received_qty: 0,
          barcode: "987654321"
        }
      ]
    },
    {
      request_number: "RR-002",
      client_email: "client2@example.com",
      client_name: "ИП Иванов",
      status: "в обработке",
      items: [
        {
          product_name: "Кофеварка Philips",
          sku: "PH-001",
          expected_qty: 20,
          received_qty: 15,
          barcode: "456789123"
        }
      ]
    },
    {
      request_number: "RR-003",
      client_email: "client3@example.com",
      client_name: "ЗАО ТехноСервис",
      status: "принята",
      items: [
        {
          product_name: "Монитор LG",
          sku: "LG-001",
          expected_qty: 8,
          received_qty: 8,
          barcode: "789123456"
        }
      ]
    },
    {
      request_number: "RR-004",
      client_email: "client4@example.com",
      client_name: "ООО Логистика Плюс",
      status: "новая",
      items: [
        {
          product_name: "Клавиатура Logitech",
          sku: "LT-001",
          expected_qty: 30,
          received_qty: 0,
          barcode: "321654987"
        }
      ]
    },
    {
      request_number: "RR-005",
      client_email: "client5@example.com",
      client_name: "ИП Петрова",
      status: "принята",
      items: [
        {
          product_name: "Мышь беспроводная",
          sku: "MS-001",
          expected_qty: 25,
          received_qty: 25,
          barcode: "654987321"
        }
      ]
    }
  ];

  for (const request of receptionRequests) {
    try {
      await db.entities.ReceptionRequest.create(request);
      console.log(`Created reception request: ${request.request_number}`);
    } catch (error) {
      console.error(`Error creating reception request ${request.request_number}:`, error);
    }
  }
};

// Создание тестовых заказов на отгрузку (исходящий поток)
const createTestAssemblyOrders = async () => {
  const assemblyOrders = [
    {
      order_number: "AO-001",
      client_email: "client1@example.com",
      client_name: "ООО Рога и Копыта",
      status: "новая",
      items: [
        {
          product_name: "Смартфон Samsung Galaxy",
          sku: "SG-001",
          quantity: 5,
          honest_mark: "HM001"
        }
      ]
    },
    {
      order_number: "AO-002",
      client_email: "client2@example.com",
      client_name: "ИП Иванов",
      status: "в обработке",
      items: [
        {
          product_name: "Кофеварка Philips",
          sku: "PH-001",
          quantity: 3,
          honest_mark: "HM002"
        }
      ]
    },
    {
      order_number: "AO-003",
      client_email: "client3@example.com",
      client_name: "ЗАО ТехноСервис",
      status: "упакована",
      items: [
        {
          product_name: "Монитор LG",
          sku: "LG-001",
          quantity: 2,
          honest_mark: "HM003"
        }
      ]
    },
    {
      order_number: "AO-004",
      client_email: "client4@example.com",
      client_name: "ООО Логистика Плюс",
      status: "отгружена",
      items: [
        {
          product_name: "Клавиатура Logitech",
          sku: "LT-001",
          quantity: 10,
          honest_mark: "HM004"
        }
      ]
    },
    {
      order_number: "AO-005",
      client_email: "client5@example.com",
      client_name: "ИП Петрова",
      status: "отгружена",
      items: [
        {
          product_name: "Мышь беспроводная",
          sku: "MS-001",
          quantity: 8,
          honest_mark: "HM005"
        }
      ]
    }
  ];

  for (const order of assemblyOrders) {
    try {
      await db.entities.AssemblyOrder.create(order);
      console.log(`Created assembly order: ${order.order_number}`);
    } catch (error) {
      console.error(`Error creating assembly order ${order.order_number}:`, error);
    }
  }
};

// Создание тестовых пользователей с разными ролями
const createTestUsers = async () => {
  const users = [
    {
      username: "admin",
      email: "admin@wms.com",
      password: "admin123",
      full_name: "Администратор Системы",
      role: "admin",
      company_name: "WMS Company",
      is_active: true // Админ должен быть активен
    },
    {
      username: "manager",
      email: "manager@wms.com",
      password: "manager123",
      full_name: "Менеджер Склада",
      role: "manager",
      company_name: "WMS Company",
      is_active: true
    },
    {
      username: "client1",
      email: "client1@example.com",
      password: "client123",
      full_name: "Клиент Один",
      role: "client",
      company_name: "ООО Рога и Копыта",
      is_active: true
    },
    {
      username: "inactive_user",
      email: "inactive@example.com",
      password: "inactive123",
      full_name: "Неактивный Пользователь",
      role: "client",
      company_name: "Тестовая Компания",
      is_active: false // Этот пользователь неактивен
    }
  ];

  for (const userData of users) {
    try {
      // Сначала регистрируем пользователя
      await db.auth.register(userData.username, userData.email, userData.password, userData.full_name, userData.role);

      // Затем обновляем дополнительные поля
      const users = await db.entities.User.filter({ username: userData.username });
      if (users.length > 0) {
        const user = users[0];
        await db.entities.User.update(user.id, {
          company_name: userData.company_name,
          is_active: userData.is_active
        });
      }

      console.log(`Created user: ${userData.username} (${userData.role}) - Active: ${userData.is_active}`);
    } catch (error) {
      console.error(`Error creating user ${userData.username}:`, error);
    }
  }
};

// Запуск создания тестовых данных
const createTestData = async () => {
  console.log("Creating test users...");
  await createTestUsers();

  console.log("Creating test reception requests...");
  await createTestReceptionRequests();

  console.log("Creating test assembly orders...");
  await createTestAssemblyOrders();

  console.log("Test data creation completed!");
};

// Экспорт функции для использования в консоли
window.createTestData = createTestData;