CREATE TABLE `notifications` (
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
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
