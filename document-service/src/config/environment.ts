export type DocumentServiceEnvironment = {
  googleWorkspace?: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    masterContractTemplateId: string;
    generatedDocumentsFolderId: string;
  };
};
