CREATE TABLE `contract_files` (
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
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contract_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contract_number_sequence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL,
	`lastNumber` int NOT NULL DEFAULT 0,
	CONSTRAINT `contract_number_sequence_id` PRIMARY KEY(`id`),
	CONSTRAINT `contract_number_sequence_year_unique` UNIQUE(`year`)
);
--> statement-breakpoint
CREATE TABLE `contract_status_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contractId` int NOT NULL,
	`previousStatus` varchar(50),
	`newStatus` varchar(50) NOT NULL,
	`changedByUserId` int,
	`changedByUserName` varchar(255),
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contract_status_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contractNumber` varchar(50) NOT NULL,
	`contractDate` timestamp NOT NULL,
	`subject` text NOT NULL,
	`contractType` enum('supply','rent','services') NOT NULL,
	`status` enum('draft','pending_customer','pending_contractor','awaiting_payment','paid','in_progress','completed','rejected') NOT NULL DEFAULT 'draft',
	`amount` decimal(15,2),
	`amountNotSpecified` boolean NOT NULL DEFAULT false,
	`vatRate` int DEFAULT 20,
	`vatAmount` decimal(15,2),
	`validUntil` timestamp,
	`prolongation` boolean NOT NULL DEFAULT false,
	`counterpartyId` int NOT NULL,
	`counterpartyEmail` varchar(320),
	`paymentFrequency` enum('none','month','quarter','year') NOT NULL DEFAULT 'none',
	`createdByUserId` int,
	`responsibleUserId` int,
	`generatedContractUrl` text,
	`generatedActUrl` text,
	`rejectionComment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contracts_id` PRIMARY KEY(`id`),
	CONSTRAINT `contracts_contractNumber_unique` UNIQUE(`contractNumber`)
);
--> statement-breakpoint
CREATE TABLE `counterparties` (
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
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `counterparties_id` PRIMARY KEY(`id`),
	CONSTRAINT `counterparties_inn_unique` UNIQUE(`inn`)
);
--> statement-breakpoint
CREATE TABLE `email_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contractId` int NOT NULL,
	`recipientEmail` varchar(320) NOT NULL,
	`subject` varchar(500) NOT NULL,
	`body` text NOT NULL,
	`status` enum('sent','failed','pending') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `predefined_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`login` varchar(64) NOT NULL,
	`password` varchar(255) NOT NULL,
	`displayName` varchar(255) NOT NULL,
	`organization` varchar(255) NOT NULL,
	`role` enum('it_head','director_roga','director_loto') NOT NULL,
	`email` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `predefined_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `predefined_users_login_unique` UNIQUE(`login`)
);
