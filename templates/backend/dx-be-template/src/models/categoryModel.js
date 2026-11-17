import sql, { getPool } from "../config/db.js";




// GET ALL CATEGORIES
export const findAllCategories = async () => {
  const pool = await getPool();

  const result = await pool.request().query(`
    SELECT
      category_id,
      category_name,
      active_flag,
      create_by,
      create_date,
      update_by,
      update_date
    FROM dbo.dx_ams_m_category
    ORDER BY category_id ASC
  `);

  return result.recordset;
};

// GET CATEGORY BY ID
export const findCategoryById = async (categoryId) => {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("category_id", sql.Int, categoryId)
    .query(`
      SELECT TOP 1
        category_id,
        category_name,
        active_flag,
        create_by,
        create_date,
        update_by,
        update_date
      FROM dbo.dx_ams_m_category
      WHERE category_id = @category_id
    `);

  return result.recordset[0] || null;
};

// FIND CATEGORY BY NAME
export const findCategoryByName = async (
  categoryName,
  excludeId = null
) => {
  const pool = await getPool();

  const request = pool.request()
    .input("category_name", sql.VarChar(sql.MAX), categoryName);

  let query = `
    SELECT TOP 1 category_id
    FROM dbo.dx_ams_m_category
    WHERE LOWER(LTRIM(RTRIM(category_name))) =
          LOWER(LTRIM(RTRIM(@category_name)))
  `;

  if (excludeId !== null) {
    request.input("exclude_id", sql.Int, excludeId);
    query += ` AND category_id <> @exclude_id`;
  }

  const result = await request.query(query);

  return result.recordset[0] || null;
};

// CREATE CATEGORY
export const insertCategory = async ({
  categoryName,
  activeFlag,
  username,
}) => {
  const pool = await getPool();

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const request = new sql.Request(transaction);

    // Generate ID secara manual dengan locking
    const idResult = await request.query(`
      SELECT ISNULL(MAX(category_id), 0) + 1 AS next_id
      FROM dbo.dx_ams_m_category WITH (TABLOCKX, HOLDLOCK)
    `);

    const categoryId = idResult.recordset[0].next_id;

    const insertRequest = new sql.Request(transaction);

    insertRequest
      .input("category_id", sql.Int, categoryId)
      .input("category_name", sql.VarChar(sql.MAX), categoryName)
      .input("active_flag", sql.Int, activeFlag)
      .input("create_by", sql.VarChar(sql.MAX), username);

    await insertRequest.query(`
      INSERT INTO dbo.dx_ams_m_category (
        category_id,
        category_name,
        active_flag,
        create_by,
        create_date
      )
      VALUES (
        @category_id,
        @category_name,
        @active_flag,
        @create_by,
        GETDATE()
      )
    `);

    await transaction.commit();

    return await findCategoryById(categoryId);
  } catch (error) {
    if (transaction._aborted !== true) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {

      }
    }

    throw error;
  }
};

// UPDATE CATEGORY
export const updateCategory = async ({
  categoryId,
  categoryName,
  activeFlag,
  username,
}) => {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("category_id", sql.Int, categoryId)
    .input("category_name", sql.VarChar(sql.MAX), categoryName)
    .input("active_flag", sql.Int, activeFlag)
    .input("update_by", sql.VarChar(sql.MAX), username)
    .query(`
      UPDATE dbo.dx_ams_m_category
      SET
        category_name = @category_name,
        active_flag = @active_flag,
        update_by = @update_by,
        update_date = GETDATE()
      WHERE category_id = @category_id;

      SELECT @@ROWCOUNT AS affected_rows;
    `);

  return result.recordset[0].affected_rows > 0;
};