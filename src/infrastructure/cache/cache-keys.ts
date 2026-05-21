export const cacheKeys = {
  bot: {
    status: () => 'bot:status',
  },
  rpg: {
    tableCreateDraft: (draftId: string) => `rpg:table:create:draft:${draftId}`,
  },
};
