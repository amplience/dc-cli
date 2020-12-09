let responseQueue: string[] = [];

module.exports = {
  createInterface: jest.fn().mockReturnValue({
    question: jest.fn().mockImplementation((questionText, cb) => {
      console.log(questionText);
      if (responseQueue.length == 0) {
        throw new Error('Too many responses given.');
      }
      cb(responseQueue[0]);
      responseQueue.splice(0, 1);
    }),
    close: (): boolean => true
  }),
  setResponses: (responses: string[]): void => {
    responseQueue = responses;
  },
  addResponse: (response: string): number => responseQueue.push(response),
  responsesLeft: (): number => responseQueue.length
};
