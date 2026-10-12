import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1735689600000 implements MigrationInterface {
  name = 'InitialSchema1735689600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`users\` (
        \`id\` CHAR(36) NOT NULL,
        \`google_sub\` VARCHAR(255) NOT NULL,
        \`email\` VARCHAR(160) NOT NULL,
        \`acronym\` VARCHAR(20) NOT NULL,
        \`name\` VARCHAR(120) NOT NULL,
        \`avatar_url\` VARCHAR(500) NULL,
        \`role\` ENUM('member', 'manager', 'admin') NOT NULL DEFAULT 'member',
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`IDX_users_google_sub\` (\`google_sub\`),
        UNIQUE INDEX \`IDX_users_email\` (\`email\`),
        UNIQUE INDEX \`IDX_users_acronym\` (\`acronym\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`clients\` (
        \`id\` CHAR(36) NOT NULL,
        \`name\` VARCHAR(160) NOT NULL,
        \`color\` CHAR(7) NOT NULL DEFAULT '#4A90D9',
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`IDX_clients_name\` (\`name\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`projects\` (
        \`id\` CHAR(36) NOT NULL,
        \`client_id\` CHAR(36) NOT NULL,
        \`name\` VARCHAR(160) NOT NULL,
        \`is_archived\` TINYINT(1) NOT NULL DEFAULT 0,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`IDX_projects_client_id_name\` (\`client_id\`, \`name\`),
        CONSTRAINT \`FK_projects_client_id\`
          FOREIGN KEY (\`client_id\`) REFERENCES \`clients\`(\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`tags\` (
        \`id\` CHAR(36) NOT NULL,
        \`project_id\` CHAR(36) NOT NULL,
        \`name\` VARCHAR(80) NOT NULL,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`IDX_tags_project_id_name\` (\`project_id\`, \`name\`),
        UNIQUE INDEX \`IDX_tags_id_project_id\` (\`id\`, \`project_id\`),
        CONSTRAINT \`FK_tags_project_id\`
          FOREIGN KEY (\`project_id\`) REFERENCES \`projects\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`time_entries\` (
        \`id\` CHAR(36) NOT NULL,
        \`user_id\` CHAR(36) NOT NULL,
        \`project_id\` CHAR(36) NULL,
        \`description\` VARCHAR(500) NOT NULL DEFAULT '',
        \`started_at\` DATETIME(3) NOT NULL,
        \`ended_at\` DATETIME(3) NULL,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_time_entries_user_id_started_at\` (\`user_id\`, \`started_at\`),
        INDEX \`IDX_time_entries_project_id_started_at\` (\`project_id\`, \`started_at\`),
        UNIQUE INDEX \`IDX_time_entries_id_project_id\` (\`id\`, \`project_id\`),
        CONSTRAINT \`FK_time_entries_user_id\`
          FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`),
        CONSTRAINT \`FK_time_entries_project_id\`
          FOREIGN KEY (\`project_id\`) REFERENCES \`projects\`(\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`CHK_time_entries_ended_after_started\`
          CHECK (\`ended_at\` IS NULL OR \`ended_at\` > \`started_at\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`time_entry_tags\` (
        \`time_entry_id\` CHAR(36) NOT NULL,
        \`tag_id\` CHAR(36) NOT NULL,
        \`project_id\` CHAR(36) NOT NULL,
        PRIMARY KEY (\`time_entry_id\`, \`tag_id\`),
        CONSTRAINT \`FK_time_entry_tags_time_entry\`
          FOREIGN KEY (\`time_entry_id\`, \`project_id\`)
          REFERENCES \`time_entries\`(\`id\`, \`project_id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_time_entry_tags_tag\`
          FOREIGN KEY (\`tag_id\`, \`project_id\`)
          REFERENCES \`tags\`(\`id\`, \`project_id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`time_entry_tags\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`time_entries\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`tags\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`projects\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`clients\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`users\``);
  }
}
