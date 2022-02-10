import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// 게시물 업로드
// 1. 게시물 생성
const createWin = async (imageUrl, title, desc, userId) => {
  await prisma.$queryRaw`
    INSERT INTO
      win
      (
        title,
        description,
        image_url,
        user_id
      )
    VALUES
    (
      ${title},
      ${desc},
      ${imageUrl},
      ${userId}
    )
  `;

  // 생성된 win의 id를 리턴
  const [{ id }] = await prisma.$queryRaw`
    SELECT
      id
    FROM
      win
    ORDER BY
      id
    DESC
    LIMIT 1
  `;

  return id;
};

// tag를 DB에 저장
const createTag = async (tagName, createdWinId) => {
  const tagNameIds = [];

  for (let i = 0; i < tagName.length; i++) {
    // transaction 으로 묶어주기 <start>
    const [createTag] = await prisma.$queryRaw`
    INSERT IGNORE INTO
      tag (name)
    VALUES
      (${tagName[i]})
    `;
    const [tagNameId] = await prisma.$queryRaw`
    SELECT 
      id
    FROM
      tag
    WHERE
      name=${tagName[i]}
    `;
    tagNameIds.push(tagNameId.id);

    const [tagAndWin] = await prisma.$queryRaw`
    INSERT INTO
      tag_and_win (tag_id, win_id)
    VALUES
      (${tagNameIds[i]}, ${createdWinId})
    `;
    // <end>
  }

  return true;
};

const createTagByTagName = async tagName => {
  await prisma.$queryRaw`
    INSERT INTO tag(name)
    VALUES (${tagName})
  `;

  // 테이블에 방금 넣은 데이터가 선택될 수 있다는 것을 보장하기 위한 transaction 필요
  // or LOCK TABLE. [optional]
  const [{ id }] = await prisma.$queryRaw`
    SELECT
      tag.id
    FROM
      tag
    ORDER BY
      id
    DESC
    LIMIT 1
  `;

  return id;
};

// 2. 게시물을 board에 등록
const createWinOnBoard = async (winId, boardId) => {
  await prisma.$queryRaw`
    INSERT INTO
      board_and_win
      (
        win_id,
        board_id
      )
    VALUES
    (
      ${winId},
      ${boardId}
    )
  `;
};

// 게시물 조회 (10개씩)
const readWin = async pageNumber => {
  const LIMIT = 10
  const winList = await prisma.$queryRaw`
    SELECT
      win.id,
      win.title,
      win.description,
      win.image_url AS imageUrl,
      win.created_at AS createdAt,
      win.updated_at AS updatedAt,
      win.user_id AS userId,
      user.name AS userName,
      user.user_number AS userNumber,
      win.like_count AS likeCount
    FROM
      win
    INNER JOIN
      user
    ON
      user.id = win.user_id 
    ORDER BY
      id
    DESC
    LIMIT ${LIMIT} OFFSET ${(pageNumber - 1) * LIMIT}
  `; // Number after `LIMIT` can be provided by arguments or set as a CONSTANT

  return winList;
};
// 전체 win 게시물 수량 조회
const getTotalWinQuantity = async () => {
  return await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM win
  `;
};

// tag 게시물 조회 (10개씩)
const searchTag = async (pageNumber, tagName) => {
  const tagList = await prisma.$queryRaw`
  SELECT
    win.id,
    win.title,
    win.description,
    win.image_url AS imageUrl,
    win.created_at AS createdAt,
    win.updated_at AS updatedAt,
    win.user_id AS userId,
    user.name AS userName,
    user.user_number AS userNumber,
    win.like_count AS likeCount
  FROM
    win
  INNER JOIN
    tag_and_win
  ON 
    win.id = tag_and_win.win_id
  INNER JOIN
    tag
  ON
    tag.id = tag_and_win.tag_id
  INNER JOIN
    user
  ON
    user.id = win.user_id 
  WHERE
    tag.name = ${tagName}
  ORDER BY
    id  
  DESC
  LIMIT 10 OFFSET ${(pageNumber - 1) * 10}
  `;
  return tagList;
  // `how to search in sql with text containig letter`
};

// 특정 tag가 포함된 win 게시물 수량 조회
const getTotalWinQuantityForTag = async tagName => {
  // 1. tag와 tag_and_win을 JOIN하면 (especially LEFT JOIN), SQL 한 번으로 진행하실 수 있을 것 같습니다.
  // 2. DAO에 자바스크립트 로직인 `if-else` 구문이 있는 것이 어색합니다. (위 1번을 적용하시면, 로직(if-else)없이도 해결하게 됩니다. )
  const [findTagId] = await prisma.$queryRaw`
  SELECT 
    id
  FROM
    tag
  WHERE
    tag.name = ${tagName}
    `;

  if (findTagId === undefined) {
    return [{ count: 0 }];
  } else {
    const count = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM 
      tag_and_win
    WHERE
      tag_and_win.tag_id = ${findTagId.id}
    `;
    console.log(count);
    return count;
  }
};

// 게시물 상세 조회
const getWinByWinId = async winId => {
  const [winDetail] = await prisma.$queryRaw`
    SELECT
      win.id,
      title,
      description,
      image_url AS imageUrl,
      win.created_at AS createdAt,
      win.updated_at AS updateAt,
      user_id AS authorId,
      user.name AS author,
      user.follower_count AS followerCount,
      user.user_number AS userNumber
    FROM
      win
    JOIN
      user
    ON
      win.user_id=user.id
    WHERE
      win.id=${winId}
  `;

  return winDetail;
};

// 게시물의 tag 조회
const getTagByWinId = async winId => {
  const tags = await prisma.$queryRaw`
    SELECT
      tag.id,
      tag.name
    FROM
      win
    JOIN
      tag_and_win
    ON
      win.id=tag_and_win.win_id
    JOIN
      tag
    ON
      tag_and_win.tag_id=tag.id
    WHERE
      win.id=${winId}
  `;

  return tags;
};

// 저장된 게시물인지 조회
const getBoardAndWinByWinIdAndUserId = async (winId, userId) => {
  const isSaved = await prisma.$queryRaw`
    SELECT
      board.id,
      board.name
    FROM
      board_and_win
    JOIN
      board
    ON
      board_and_win.board_id=board.id
    WHERE
      board_and_win.win_id=${winId}
    AND
      board.user_id=${userId}
  `;

  return isSaved;
};

// 게시물 수정
// 1. 게시물 수정(board 빼고)
const updateWin = async (winId, title, desc, date) => {
  await prisma.$queryRaw`
    UPDATE
      win
    SET
      title=${title},
      description=${desc},
      updated_at=${date}
    WHERE
      win.id=${winId}
  `;

  return true;
};

// 2. 게시물의 board id 조회
const getBoardIdByWinId = async winId => {
  const boardId = await prisma.$queryRaw`
    SELECT
      board_id AS boardId
    FROM
      board_and_win
    WHERE
      win_id=${winId}
  `;

  return boardId;
};

// 3. 게시물의 board id 수정
const updateBoardOnWin = async (winId, beforeBoardId, boardId) => {
  await prisma.$queryRaw`
    UPDATE
      board_and_win
    SET
      board_id=${boardId}
    WHERE
      win_id=${winId}
    AND
      board_id=${beforeBoardId}
  `;

  return true;
};

const deleteTagAndWinByWinId = async winId => {
  return await prisma.$queryRaw`
    DELETE FROM
      tag_and_win
    WHERE
      tag_and_win.win_id=${winId}
  `;
};

const createTagAndWin = async (winId, tag) => {
  // 한 번에 여러 row 추가하는 방법 가운데 하나로 BULK INSERT 가 있습니다. 적용 고려.
  return await prisma.$queryRaw`
    INSERT INTO
      tag_and_win
      (
        win_id,
        tag_id
      )
    VALUES
    (
      ${winId},
      ${tag}
    )
  `;
};

// 게시물 삭제
// 1. 게시물 id로 이미지 url 조회
const getUrlByWinId = async winId => {
  const url = await prisma.$queryRaw`
    SELECT
      image_url AS imageUrl
    FROM
      win
    WHERE
      win.id=${winId}
  `;

  return url;
};

// 2. 게시물 id로 게시물 삭제
const deleteWinByWinId = async winId => {
  await prisma.$queryRaw`
    DELETE FROM
      win
    WHERE
      win.id=${winId}
  `;

  return true;
};

// winId로 userId(작성자) 가져오기 (게시물 수정, 삭제)
const getUserIdByWinId = async winId => {
  const [{ userId }] = await prisma.$queryRaw`
    SELECT
      win.user_id AS userId
    FROM
      win
    WHERE
      id=${winId}
  `;

  return userId;
};

// 저장된 win인지 확인
const getBoardOnWin = async (winId, userId) => {
  const [{ isExist }] = await prisma.$queryRaw`
    SELECT EXISTS
    (
      SELECT
        *
      FROM
        user
      JOIN
        board
      ON
        user.id=board.user_id
      JOIN
        board_and_win
      ON
        board.id=board_and_win.board_id
      WHERE
        user.id=${userId}
      AND
        board_and_win.win_id=${winId}
    ) AS isExist
  `;

  return !!isExist;
};

const getFollowByUserId = async (followerId, followingId) => {
  const [{ isFollowing }] = await prisma.$queryRaw`
    SELECT EXISTS
    (
      SELECT
        *
      FROM
        follow
      WHERE
        follower_id=${followerId}
      AND
        following_id=${followingId}
    ) AS isFollowing
  `;

  return !!isFollowing;
};

const getBoardIdByWinIdAndUserId = async (winId, userId) => {
  const [{ id }] = await prisma.$queryRaw`
    SELECT
      board.id
    FROM
      win
    JOIN
      board_and_win
    ON
      win.id = board_and_win.win_id
    JOIN
      board
    ON
      board_and_win.board_id = board.id
    JOIN
      user
    ON
      board.user_id = user.id
    WHERE
      win.id = ${winId}
    AND
      user.id = ${userId}
  `;

  return id;
};

const getTagByTagName = async tagName => {
  const [{ isExist }] = await prisma.$queryRaw`
      SELECT EXISTS
      (
        SELECT
          *
        FROM
          tag
        WHERE
          tag.name = ${tagName}
      ) AS isExist
    `;

  return !!isExist;
};

const getTagIdByTagName = async tagName => {
  const [{ tagId }] = await prisma.$queryRaw`
    SELECT
      tag.id AS tagId
    FROM
      tag
    WHERE
      tag.name = ${tagName}
  `;

  return tagId;
};

export default {
  createWin,
  createWinOnBoard,
  readWin,
  getTotalWinQuantity,
  searchTag,
  getTotalWinQuantityForTag,
  getWinByWinId,
  updateBoardOnWin,
  getTagByWinId,
  getBoardAndWinByWinIdAndUserId,
  updateWin,
  deleteTagAndWinByWinId,
  updateTagAndWin,
  getBoardIdByWinId,
  getUrlByWinId,
  deleteWinByWinId,
  getUserIdByWinId,
  createTag,
  createTagByTagName,
  getBoardOnWin,
  getFollowByUserId,
  getBoardIdByWinIdAndUserId,
  getTagByTagName,
  getTagIdByTagName,
};
