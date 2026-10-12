import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClockifyIds1774300000000 implements MigrationInterface {
  name = 'AddClockifyIds1774300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`users\`
      ADD COLUMN \`clockify_id\` VARCHAR(64) NULL,
      ADD UNIQUE INDEX \`IDX_users_clockify_id\` (\`clockify_id\`)
    `);
    await queryRunner.query(`
      ALTER TABLE \`clients\`
      ADD COLUMN \`clockify_id\` VARCHAR(64) NULL,
      ADD UNIQUE INDEX \`IDX_clients_clockify_id\` (\`clockify_id\`)
    `);
    await queryRunner.query(`
      ALTER TABLE \`projects\`
      ADD COLUMN \`clockify_id\` VARCHAR(64) NULL,
      ADD UNIQUE INDEX \`IDX_projects_clockify_id\` (\`clockify_id\`)
    `);
    await queryRunner.query(`
      ALTER TABLE \`tags\`
      ADD COLUMN \`clockify_id\` VARCHAR(64) NULL,
      ADD UNIQUE INDEX \`IDX_tags_clockify_id\` (\`clockify_id\`)
    `);
    await queryRunner.query(`
      ALTER TABLE \`time_entries\`
      ADD COLUMN \`clockify_id\` VARCHAR(64) NULL,
      ADD UNIQUE INDEX \`IDX_time_entries_clockify_id\` (\`clockify_id\`)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`time_entries\`
      DROP INDEX \`IDX_time_entries_clockify_id\`,
      DROP COLUMN \`clockify_id\`
    `);
    await queryRunner.query(`
      ALTER TABLE \`tags\`
      DROP INDEX \`IDX_tags_clockify_id\`,
      DROP COLUMN \`clockify_id\`
    `);
    await queryRunner.query(`
      ALTER TABLE \`projects\`
      DROP INDEX \`IDX_projects_clockify_id\`,
      DROP COLUMN \`clockify_id\`
    `);
    await queryRunner.query(`
      ALTER TABLE \`clients\`
      DROP INDEX \`IDX_clients_clockify_id\`,
      DROP COLUMN \`clockify_id\`
    `);
    await queryRunner.query(`
      ALTER TABLE \`users\`
      DROP INDEX \`IDX_users_clockify_id\`,
      DROP COLUMN \`clockify_id\`
    `);
  }
}
