const mongoose = require("mongoose");

const registrationSchema = new mongoose.Schema(
  {
    referenceId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    studentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
      match: /^\+?[0-9][0-9\s().-]{6,19}$/,
    },
    course: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    eventRound: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    semester: {
      type: Number,
      required: true,
      min: 1,
      max: 8,
      validate: {
        validator: Number.isInteger,
        message: "Semester must be a whole number from 1 to 8.",
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model("Registration", registrationSchema);
