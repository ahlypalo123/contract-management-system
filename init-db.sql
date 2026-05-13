-- =============================================================
-- Инициализация базы данных для системы управления договорами
-- Этот файл создает все таблицы и вставляет начальные данные.
-- Он монтируется в /docker-entrypoint-initdb.d/ для MySQL.
-- =============================================================

-- Используем базу данных, созданную через MYSQL_DATABASE
USE contract_management;

-- ============================================================
-- Таблица: users (пользователи OAuth)
-- ============================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id` int AUTO_INCREMENT NOT NULL,
  `openId` varchar(64) NOT NULL,
  `name` text,
  `email` varchar(320),
  `loginMethod` varchar(64),
  `role` enum('user','admin') NOT NULL DEFAULT 'user',
  `organizationInn` varchar(12),
  `organizationName` varchar(255),
  `canApprove` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_openId_unique` (`openId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Таблица: predefined_users (предустановленные пользователи)
-- ============================================================
CREATE TABLE IF NOT EXISTS `predefined_users` (
  `id` int AUTO_INCREMENT NOT NULL,
  `login` varchar(64) NOT NULL,
  `password` varchar(255) NOT NULL,
  `displayName` varchar(255) NOT NULL,
  `organization` varchar(255) NOT NULL,
  `organizationInn` varchar(12) NOT NULL,
  `role` enum('it_head','director_roga','director_hlyp') NOT NULL,
  `canApprove` boolean NOT NULL DEFAULT false,
  `email` varchar(320),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `predefined_users_login_unique` (`login`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Таблица: counterparties (контрагенты)
-- ============================================================
CREATE TABLE IF NOT EXISTS `counterparties` (
  `id` int AUTO_INCREMENT NOT NULL,
  `inn` varchar(12) NOT NULL,
  `name` varchar(500) NOT NULL,
  `shortName` varchar(255),
  `kpp` varchar(9),
  `ogrn` varchar(15),
  `address` text,
  `email` varchar(320),
  `phone` varchar(50),
  `directorName` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `counterparties_inn_unique` (`inn`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Таблица: contracts (договоры)
-- ============================================================
CREATE TABLE IF NOT EXISTS `contracts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `contractNumber` varchar(50) NOT NULL,
  `contractDate` timestamp NOT NULL,
  `subject` text NOT NULL,
  `contractType` enum('supply','rent','services','work','lease','other') NOT NULL,
  `status` enum('draft','pending_customer','pending_contractor','awaiting_payment','paid','in_progress','act_signing','completed','rejected') NOT NULL DEFAULT 'draft',
  `amount` decimal(15,2),
  `amountNotSpecified` boolean NOT NULL DEFAULT false,
  `vatRate` int DEFAULT 22,
  `vatAmount` decimal(15,2),
  `validUntil` timestamp NULL,
  `prolongation` boolean NOT NULL DEFAULT false,
  `customerInn` varchar(12) NOT NULL,
  `customerName` varchar(255),
  `counterpartyId` int NOT NULL,
  `counterpartyInn` varchar(12),
  `counterpartyEmail` varchar(320),
  `paymentFrequency` enum('none','once','monthly','quarterly','yearly') NOT NULL DEFAULT 'none',
  `createdByUserId` int,
  `responsibleUserId` int,
  `generatedContractUrl` text,
  `generatedActUrl` text,
  `rejectionComment` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `contracts_contractNumber_unique` (`contractNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Таблица: contract_history (история договоров - единая)
-- ============================================================
CREATE TABLE IF NOT EXISTS `contract_history` (
  `id` int AUTO_INCREMENT NOT NULL,
  `contractId` int NOT NULL,
  `eventType` enum('status_change','file_added','file_removed','comment') NOT NULL,
  `previousStatus` varchar(50),
  `newStatus` varchar(50),
  `fileName` varchar(255),
  `fileType` varchar(50),
  `comment` text,
  `userId` int,
  `userName` varchar(255),
  `userOrganization` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Таблица: contract_status_history (история статусов - legacy)
-- ============================================================
CREATE TABLE IF NOT EXISTS `contract_status_history` (
  `id` int AUTO_INCREMENT NOT NULL,
  `contractId` int NOT NULL,
  `previousStatus` varchar(50),
  `newStatus` varchar(50) NOT NULL,
  `changedByUserId` int,
  `changedByUserName` varchar(255),
  `comment` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Таблица: contract_files (файлы договоров)
-- ============================================================
CREATE TABLE IF NOT EXISTS `contract_files` (
  `id` int AUTO_INCREMENT NOT NULL,
  `contractId` int NOT NULL,
  `fileName` varchar(255) NOT NULL,
  `originalName` varchar(255) NOT NULL,
  `fileUrl` text NOT NULL,
  `fileKey` varchar(500) NOT NULL,
  `fileSize` bigint NOT NULL,
  `mimeType` varchar(100) NOT NULL,
  `fileType` enum('contract','act','signed_contract','payment_receipt','additional') NOT NULL,
  `uploadedByUserId` int,
  `uploadedByUserName` varchar(255),
  `isDeleted` boolean NOT NULL DEFAULT false,
  `deletedAt` timestamp NULL,
  `deletedByUserId` int,
  `deletedByUserName` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Таблица: contract_number_sequence (нумерация договоров)
-- ============================================================
CREATE TABLE IF NOT EXISTS `contract_number_sequence` (
  `id` int AUTO_INCREMENT NOT NULL,
  `year` int NOT NULL,
  `lastNumber` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `contract_number_sequence_year_unique` (`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Таблица: email_notifications (лог email-уведомлений)
-- ============================================================
CREATE TABLE IF NOT EXISTS `email_notifications` (
  `id` int AUTO_INCREMENT NOT NULL,
  `contractId` int NOT NULL,
  `recipientEmail` varchar(320) NOT NULL,
  `subject` varchar(500) NOT NULL,
  `body` text NOT NULL,
  `status` enum('sent','failed','pending') NOT NULL DEFAULT 'pending',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Таблица: notifications (уведомления пользователей)
-- ============================================================
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` int AUTO_INCREMENT NOT NULL,
  `recipientUserId` int NOT NULL,
  `recipientOrganizationInn` varchar(12) NOT NULL,
  `contractId` int NOT NULL,
  `contractNumber` varchar(50) NOT NULL,
  `notificationType` enum('status_change','comment_added','file_added','file_removed') NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `actorUserId` int,
  `actorUserName` varchar(255),
  `actorOrganization` varchar(255),
  `isRead` boolean NOT NULL DEFAULT false,
  `readAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Вставка предустановленных пользователей
-- ============================================================
INSERT INTO `predefined_users` (`login`, `password`, `displayName`, `organization`, `organizationInn`, `role`, `canApprove`, `email`) VALUES
  ('it_head', 'it@rogakopita', 'Начальник управления ИТ', 'ООО "Рога и копыта"', '7707083893', 'it_head', false, 'it_head@rogakopita.ru'),
  ('director_roga', 'dir@rogakopita', 'Директор', 'ООО "Рога и копыта"', '7707083893', 'director_roga', true, 'director@rogakopita.ru'),
  ('director_hlyp', 'dir@hlyp', 'Директор', 'Хлыпало и КО', '1111111111', 'director_hlyp', true, 'director@hlyp.ru')
ON DUPLICATE KEY UPDATE
  `password` = VALUES(`password`),
  `displayName` = VALUES(`displayName`),
  `organization` = VALUES(`organization`),
  `organizationInn` = VALUES(`organizationInn`),
  `canApprove` = VALUES(`canApprove`),
  `email` = VALUES(`email`);

-- ============================================================
-- Вставка известных организаций в таблицу контрагентов
-- ============================================================
INSERT INTO `counterparties` (`inn`, `name`, `shortName`, `address`, `directorName`) VALUES
  ('7707083893', 'ООО "Рога и копыта"', 'Рога и копыта', 'г. Москва, ул. Примерная, д. 1', 'Иванов И.И.'),
  ('1111111111', 'Хлыпало и КО', 'Хлыпало и КО', 'г. Москва, ул. Деловая, д. 10', 'Хлыпало А.А.')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `shortName` = VALUES(`shortName`),
  `address` = VALUES(`address`),
  `directorName` = VALUES(`directorName`);

-- ============================================================
-- Готово!
-- ============================================================
SELECT 'Database initialization completed successfully' AS status;
