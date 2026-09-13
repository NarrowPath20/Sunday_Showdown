(function (root) {
  "use strict";

  const rows = [
    ["People", 200, "Who built the ark before the great flood?", "Noah"],
    ["People", 400, "Who interpreted Pharaoh's dreams in Egypt?", "Joseph"],
    ["People", 600, "Which young shepherd defeated Goliath?", "David"],
    ["People", 800, "Which prophet was swallowed by a great fish?", "Jonah"],
    ["People", 1000, "Who is named as the first Christian martyr in Acts?", "Stephen"],

    ["Places", 200, "In which town was Jesus born?", "Bethlehem"],
    ["Places", 400, "The walls of which city fell after Israel marched around them?", "Jericho"],
    ["Places", 600, "On which mountain did Moses receive the Ten Commandments?", "Mount Sinai"],
    ["Places", 800, "On the road to which city did Saul encounter Jesus?", "Damascus"],
    ["Places", 1000, "In which garden did Jesus pray before His arrest?", "Gethsemane"],

    ["Miracles", 200, "At a wedding, what did Jesus turn water into?", "Wine"],
    ["Miracles", 400, "Jesus fed a crowd with five loaves and how many fish?", "Two fish"],
    ["Miracles", 600, "Whom did Jesus call out of the tomb after four days?", "Lazarus"],
    ["Miracles", 800, "What did Jesus calm while crossing the Sea of Galilee?", "A storm / the wind and waves"],
    ["Miracles", 1000, "In which river did Naaman wash seven times and become healed?", "The Jordan River"],

    ["Parables", 200, "Which compassionate traveler helped an injured man beside the road?", "The Good Samaritan"],
    ["Parables", 400, "How many sheep were left while the shepherd searched for the one that was lost?", "Ninety-nine"],
    ["Parables", 600, "In Jesus' story, seed fell on a path, rocky ground, thorns, and what fourth place?", "Good soil"],
    ["Parables", 800, "Which son returned home and was welcomed with a celebration?", "The prodigal son / lost son"],
    ["Parables", 1000, "In the parable of the talents, what did the servant with one talent do with it?", "He buried it in the ground"],

    ["Bible Books", 200, "What is the first book of the Bible?", "Genesis"],
    ["Bible Books", 400, "Which book is a collection of songs and prayers?", "Psalms"],
    ["Bible Books", 600, "What are the first four books of the New Testament collectively called?", "The Gospels"],
    ["Bible Books", 800, "Which New Testament letter comes immediately after Acts?", "Romans"],
    ["Bible Books", 1000, "What is the final book of the New Testament?", "Revelation"],

    ["By the Numbers", 200, "How many days did God use for creation before resting on the seventh?", "Six"],
    ["By the Numbers", 400, "How many apostles did Jesus choose?", "Twelve"],
    ["By the Numbers", 600, "How many plagues came upon Egypt in Exodus?", "Ten"],
    ["By the Numbers", 800, "For how many years did Israel wander in the wilderness?", "Forty years"],
    ["By the Numbers", 1000, "How many qualities are listed as the fruit of the Spirit in Galatians 5?", "Nine"]
  ];

  root.STARTER_PACK = {
    title: "Bible Basics",
    source: "starter",
    questions: rows.map(function (row, index) {
      return {
        id: "starter-" + (index + 1),
        category: row[0],
        value: row[1],
        question: row[2],
        answer: row[3],
        choices: []
      };
    }),
    final: {
      category: "The Big Picture",
      question: "According to Jesus, which two commandments are the greatest?",
      answer: "Love God with all your heart, soul, and mind; and love your neighbor as yourself."
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
