export const print = (error) => {
  console.log(error.msg ? error.msg : error.message ? error.message : error);
};
