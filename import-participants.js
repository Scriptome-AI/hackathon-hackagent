const { App, ExpressReceiver } = require('@slack/bolt');
const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Custom receiver for your domain path
const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  endpoints: '/hackathon-hackagent/slack/events',
  processBeforeResponse: true
});

// Initialize app with the receiver
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver
});

// Load participants data
let participants = [];
try {
  const participantsData = fs.readFileSync(
    path.join(__dirname, 'participants.json'), 
    'utf8'
  );
  participants = JSON.parse(participantsData);
  console.log(`Loaded ${participants.length} participants`);
} catch (error) {
  console.error('Error loading participants:', error.message);
  // Initialize with empty array if file doesn't exist
  participants = [];
}

// Helper function to save participants data
const saveParticipants = () => {
  try {
    fs.writeFileSync(
      path.join(__dirname, 'participants.json'),
      JSON.stringify(participants, null, 2),
      'utf8'
    );
    console.log('Participants data saved');
  } catch (error) {
    console.error('Error saving participants:', error.message);
  }
};

// Add a root route
receiver.app.get('/hackathon-hackagent', (req, res) => {
  res.send('HackAgent is running! This bot helps manage the AI Agent Building Hackathon for Biotech R&D.');
});

// Add security headers
receiver.app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Respond to app mentions
app.event('app_mention', async ({ event, say }) => {
  await say(`Hello! How can I help with the hackathon? Try commands like \`/schedule\`, \`/faq\`, \`/team-find\`, or \`/submit\`.`);
});

// Handle schedule command
app.command('/schedule', async ({ command, ack, respond }) => {
  await ack();
  
  await respond({
    text: "Here's the schedule for our AI Agent Building Hackathon:",
    blocks: [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*AI Agent Building Hackathon Schedule*"
        }
      },
      {
        "type": "section", 
        "text": {
          "type": "mrkdwn",
          "text": "*8:00 - 8:30 AM:* Registration & Breakfast\n*8:30 - 9:00 AM:* Welcome & Introduction\n*9:00 - 9:30 AM:* Keynote Presentation\n*9:30 - 10:00 AM:* Technical Workshop\n*10:00 - 10:15 AM:* Challenge Presentation\n*10:15 - 10:30 AM:* Team Formation\n*10:30 - 12:30 PM:* Hacking Session 1\n*12:30 - 1:30 PM:* Lunch Break\n*1:30 - 3:30 PM:* Hacking Session 2\n*3:30 - 4:00 PM:* Preparation for Presentations\n*4:00 - 5:00 PM:* Project Presentations\n*5:00 - 5:30 PM:* Judging & Networking\n*5:30 - 6:00 PM:* Awards & Closing"
        }
      }
    ]
  });
});

// Handle FAQ command
app.command('/faq', async ({ command, ack, respond }) => {
  await ack();
  
  await respond({
    text: "Frequently Asked Questions",
    blocks: [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*Frequently Asked Questions*"
        }
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*Q: What should I bring?*\nA: Your laptop, charger, and enthusiasm!\n\n*Q: Is there WiFi?*\nA: Yes, network: 'HackathonWifi', password: 'BiotechAI2025'\n\n*Q: Where can I find resources?*\nA: Check the #resources channel for APIs and datasets."
        }
      }
    ]
  });
});

// Enhanced team formation command
app.command('/team-find', async ({ command, ack, respond, client }) => {
  await ack();
  
  const skills = command.text.trim();
  
  if (!skills) {
    await respond({
      text: "Please specify what skills you're looking for. Example: `/team-find AI, Python, Biology`"
    });
    return;
  }
  
  // Get user info for the team creation post
  try {
    const userInfo = await app.client.users.info({
      user: command.user_id
    });
    
    const userName = userInfo.user.real_name || userInfo.user.name;
    const userEmail = userInfo.user.profile.email;
    
    // Find participant by email
    const participant = participants.find(p => p.email.toLowerCase() === userEmail.toLowerCase());
    
    // Add skills to the participant's record if they exist in our database
    if (participant) {
      // Update participant's team status
      participant.lookingForTeam = false;
      saveParticipants();
    }
    
    // Suggest potential team members based on requested skills
    const skillsToFind = skills.split(',').map(s => s.trim().toLowerCase());
    const potentialMembers = participants.filter(p => 
      p.lookingForTeam && 
      p.skills.some(skill => 
        skillsToFind.some(s => skill.toLowerCase().includes(s))
      )
    ).slice(0, 5); // Limit to 5 suggestions
    
    // Create the team request post
    let blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `📢 *Team Member Wanted!*\n\n*${userName}* is looking for team members with these skills:\n${skills}`
        }
      }
    ];
    
    // Add potential matches if any
    if (potentialMembers.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Potential matches based on skills:*`
        }
      });
      
      potentialMembers.forEach(member => {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `• *${member.name}* - Skills: ${member.skills.join(', ')}`
          }
        });
      });
    }
    
    // Add contact information
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `If you're interested in joining ${userName}'s team, please reach out to <@${command.user_id}> directly!`
      }
    });
    
    await respond({
      blocks: blocks,
      response_type: 'in_channel' // Makes this visible to everyone
    });
    
  } catch (error) {
    console.error(error);
    await respond({
      text: "Sorry, there was an error processing your request."
    });
  }
});

// Command to update your skills
app.command('/update-skills', async ({ command, ack, respond }) => {
  await ack();
  
  const skills = command.text.trim();
  
  if (!skills) {
    await respond({
      text: "Please specify your skills. Example: `/update-skills AI, Python, Biology`"
    });
    return;
  }
  
  // Find participant by email using Slack email
  try {
    const userInfo = await app.client.users.info({
      user: command.user_id
    });
    
    const userEmail = userInfo.user.profile.email;
    const participant = participants.find(p => p.email.toLowerCase() === userEmail.toLowerCase());
    
    if (participant) {
      participant.skills = skills.split(',').map(s => s.trim());
      saveParticipants();
      
      await respond({
        text: `✅ Skills updated! Others can now find you when they're looking for team members with these skills.`
      });
    } else {
      await respond({
        text: `ℹ️ Your email (${userEmail}) isn't in our pre-registered list. Please see an organizer for help.`
      });
    }
  } catch (error) {
    console.error(error);
    await respond({
      text: "Sorry, there was an error updating your skills."
    });
  }
});

// Command to find participants with specific skills
app.command('/find-skills', async ({ command, ack, respond }) => {
  await ack();
  
  const searchSkills = command.text.trim();
  
  if (!searchSkills) {
    await respond({
      text: "Please specify skills to search for. Example: `/find-skills Python, Biology`"
    });
    return;
  }
  
  const skillsToFind = searchSkills.split(',').map(s => s.trim().toLowerCase());
  
  // Find participants who have any of the requested skills
  const matches = participants.filter(p => 
    p.skills.some(skill => 
      skillsToFind.some(s => skill.toLowerCase().includes(s))
    )
  );
  
  if (matches.length === 0) {
    await respond({
      text: `No participants found with skills in: ${searchSkills}. Try broadening your search or using more general terms.`
    });
    return;
  }
  
  // Create a formatted response
  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Participants with ${searchSkills} skills:*`
      }
    }
  ];
  
  // Add each match to the response
  matches.forEach(match => {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${match.name}*\nSkills: ${match.skills.join(', ')}`
      }
    });
  });
  
  await respond({
    blocks: blocks
  });
});

// Command to list all participants
app.command('/participants', async ({ command, ack, respond }) => {
  await ack();
  
  // If there are too many participants, paginate or filter
  if (participants.length > 20) {
    // Open a modal with search options
    try {
      await app.client.views.open({
        trigger_id: command.trigger_id,
        view: {
          type: "modal",
          callback_id: "participants_search",
          title: {
            type: "plain_text",
            text: "Search Participants"
          },
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `There are ${participants.length} registered participants. Use commands to find specific participants:\n• \`/find-skills Python, Biology\` to find by skills\n• \`/update-skills AI, Cloud\` to update your skills`
              }
            }
          ]
        }
      });
    } catch (error) {
      console.error(error);
      await respond({
        text: `There are ${participants.length} registered participants. Use '/find-skills' to search by specific skills.`
      });
    }
    return;
  }
  
  // If fewer than 20 participants, show them all
  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Registered Participants (${participants.length}):*`
      }
    }
  ];
  
  // Group participants by 5 to avoid message length limits
  for (let i = 0; i < participants.length; i += 5) {
    const participantGroup = participants.slice(i, i + 5);
    const text = participantGroup.map(p => 
      `• *${p.name}*${p.skills.length > 0 ? ` - Skills: ${p.skills.join(', ')}` : ''}`
    ).join('\n');
    
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text
      }
    });
  }
  
  await respond({
    blocks
  });
});

// Command for hackathon stats
app.command('/hackathon-stats', async ({ command, ack, respond }) => {
  await ack();
  
  const totalParticipants = participants.length;
  const participantsWithSkills = participants.filter(p => p.skills.length > 0).length;
  const lookingForTeam = participants.filter(p => p.lookingForTeam).length;
  
  await respond({
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Hackathon Stats:*\n• Total Participants: ${totalParticipants}\n• Participants with Skills Listed: ${participantsWithSkills}\n• Looking for Team: ${lookingForTeam}`
        }
      }
    ]
  });
});

// Submission command
app.command('/submit', async ({ command, ack, respond, client }) => {
  await ack();
  
  // Open a modal for submission
  try {
    const result = await client.views.open({
      trigger_id: command.trigger_id,
      view: {
        type: "modal",
        callback_id: "submission_view",
        title: {
          type: "plain_text",
          text: "Submit Your Project"
        },
        submit: {
          type: "plain_text",
          text: "Submit"
        },
        blocks: [
          {
            type: "input",
            block_id: "project_name",
            element: {
              type: "plain_text_input",
              action_id: "name"
            },
            label: {
              type: "plain_text",
              text: "Project Name"
            }
          },
          {
            type: "input",
            block_id: "project_desc",
            element: {
              type: "plain_text_input",
              multiline: true,
              action_id: "desc"
            },
            label: {
              type: "plain_text",
              text: "Description"
            }
          },
          {
            type: "input",
            block_id: "project_link",
            element: {
              type: "plain_text_input",
              action_id: "link"
            },
            label: {
              type: "plain_text",
              text: "GitHub/Demo Link"
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error(error);
  }
});

// Handle modal submission
app.view('submission_view', async ({ ack, body, view, client }) => {
  await ack();
  
  // Get values from the submission
  const projectName = view.state.values.project_name.name.value;
  const projectDesc = view.state.values.project_desc.desc.value;
  const projectLink = view.state.values.project_link.link.value;
  const userId = body.user.id;
  
  // Post to a dedicated submissions channel
  try {
    await client.chat.postMessage({
      channel: 'C0123456789', // Replace with your submissions channel ID
      text: `New Project Submission!`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*New Project Submission!*`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Project:* ${projectName}\n*By:* <@${userId}>\n*Description:* ${projectDesc}\n*Link:* ${projectLink}`
          }
        }
      ]
    });
    
    // Notify the user
    await client.chat.postMessage({
      channel: userId,
      text: `Thanks for submitting your project "${projectName}"! The judges will review it shortly.`
    });
  } catch (error) {
    console.error(error);
  }
});

// Schedule reminders for key events
const scheduleReminder = async (channelId, message, time) => {
  try {
    // Schedule a message for future delivery
    const result = await app.client.chat.scheduleMessage({
      channel: channelId,
      text: message,
      post_at: time // Unix timestamp
    });
  } catch (error) {
    console.error(error);
  }
};

// Example of scheduling reminders for your event day
// Uncomment and modify these with your actual event date and channel ID
/*
const eventDate = new Date('2025-05-01'); // Replace with your event date

// Morning welcome reminder
const morningTime = new Date(eventDate);
morningTime.setHours(8, 20, 0, 0);
scheduleReminder('C0123456789', '🌞 Good morning hackers! Registration is open and breakfast is being served. The welcome session begins in 10 minutes!', Math.floor(morningTime.getTime() / 1000));

// Lunch reminder
const lunchTime = new Date(eventDate);
lunchTime.setHours(12, 25, 0, 0);
scheduleReminder('C0123456789', '🍕 Lunch will be served in 5 minutes!', Math.floor(lunchTime.getTime() / 1000));

// Presentation prep reminder
const prepTime = new Date(eventDate);
prepTime.setHours(15, 15, 0, 0);
scheduleReminder('C0123456789', '⏰ 15 minutes until coding stops! Start wrapping up your projects and prepare for presentations.', Math.floor(prepTime.getTime() / 1000));
*/

// Start the app
(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ HackAgent is running at https://scriptome.ai/hackathon-hackagent');
})();